/**
 * DatabaseService ユニットテスト
 */

import * as fs from 'fs';
import * as path from 'path';
import { DatabaseService } from '../../services/databaseService';
import { Session } from '../../types';
import { createMockSession, createMockPayment, createMockMember } from '../helpers/mockData';

describe('DatabaseService', () => {
  let dbService: DatabaseService;
  const testDataDir = path.join(__dirname, '../test-data');
  const testDbPath = path.join(testDataDir, 'test-database.db');

  // テスト用のセッションデータ
  const mockSession: Session = createMockSession('test-group-001', {
    payments: [
      createMockPayment('pay001', 1, 'user001', 'テストユーザー1', '一軒目', 5000, ['user001'])
    ]
  });

  beforeAll(() => {
    // テストデータディレクトリを作成
    if (!fs.existsSync(testDataDir)) {
      fs.mkdirSync(testDataDir, { recursive: true });
    }
  });

  beforeEach(() => {
    // 既存のDBサービスをクローズ
    if (dbService) {
      try {
        dbService.close();
      } catch (e) {
        // 無視
      }
    }

    // 実際のデータベースファイルパス
    const actualDbPath = path.join(__dirname, '../../data/database.db');

    // 各テストの前にDBをクリーンアップ
    if (fs.existsSync(actualDbPath)) {
      fs.unlinkSync(actualDbPath);
    }
    if (fs.existsSync(`${actualDbPath}-wal`)) {
      fs.unlinkSync(`${actualDbPath}-wal`);
    }
    if (fs.existsSync(`${actualDbPath}-shm`)) {
      fs.unlinkSync(`${actualDbPath}-shm`);
    }

    // テスト用DBサービスを初期化
    dbService = new DatabaseService();
  });

  afterAll(() => {
    // テスト後のクリーンアップ
    if (dbService) {
      dbService.close();
    }

    // テストデータディレクトリを削除
    if (fs.existsSync(testDataDir)) {
      fs.rmSync(testDataDir, { recursive: true, force: true });
    }
  });

  describe('基本操作', () => {
    test('セッションを保存できる', () => {
      // 保存実行
      expect(() => {
        dbService.saveSession(mockSession);
      }).not.toThrow();
    });

    test('セッションを取得できる', () => {
      // 保存
      dbService.saveSession(mockSession);

      // 取得
      const retrieved = dbService.getSession(mockSession.groupId);

      expect(retrieved).not.toBeNull();
      expect(retrieved?.groupId).toBe(mockSession.groupId);
      expect(retrieved?.status).toBe(mockSession.status);
    });

    test('存在しないセッションはnullを返す', () => {
      const retrieved = dbService.getSession('non-existent-group');
      expect(retrieved).toBeNull();
    });

    test('セッションを更新できる（UPSERT）', () => {
      // 初回保存
      dbService.saveSession(mockSession);

      // 更新
      const updatedSession: Session = {
        ...mockSession,
        status: 'settled' as const,
        payments: [
          ...mockSession.payments,
          createMockPayment('pay002', 2, 'user002', 'テストユーザー2', '二軒目', 3000, ['user002'])
        ]
      };

      dbService.saveSession(updatedSession);

      // 確認
      const retrieved = dbService.getSession(mockSession.groupId);
      expect(retrieved?.status).toBe('settled');
      expect(retrieved?.payments.length).toBe(2);
    });
  });

  describe('バッチ操作', () => {
    test('複数セッションを一括保存できる', () => {
      const sessions: Session[] = [
        createMockSession('group-001'),
        createMockSession('group-002'),
        createMockSession('group-003')
      ];

      expect(() => {
        dbService.batchSaveSessions(sessions);
      }).not.toThrow();

      // 確認
      const allSessions = dbService.getAllSessions();
      expect(allSessions.length).toBe(3);
    });

    test('全セッションを取得できる', () => {
      // 複数保存
      const sessions: Session[] = [
        createMockSession('group-001'),
        createMockSession('group-002')
      ];
      dbService.batchSaveSessions(sessions);

      // 全取得
      const allSessions = dbService.getAllSessions();
      expect(allSessions.length).toBe(2);
    });
  });

  describe('削除操作', () => {
    test('セッションを削除できる', () => {
      // 保存
      dbService.saveSession(mockSession);

      // 削除（IDとしてgroupIdを使用）
      dbService.deleteSession(mockSession.groupId);

      // 確認
      const allSessions = dbService.getAllSessions();
      expect(allSessions.length).toBe(0);
    });
  });

  describe('パフォーマンス', () => {
    test('1000件のセッション保存が1秒以内に完了する', () => {
      const sessions: Session[] = Array.from({ length: 1000 }, (_, i) =>
        createMockSession(`group-${i}`)
      );

      const startTime = Date.now();
      dbService.batchSaveSessions(sessions);
      const elapsed = Date.now() - startTime;

      expect(elapsed).toBeLessThan(1000);
    });

    test('セッション取得が10ms以内に完了する', () => {
      // 事前に保存
      dbService.saveSession(mockSession);

      // 取得時間を計測
      const startTime = Date.now();
      dbService.getSession(mockSession.groupId);
      const elapsed = Date.now() - startTime;

      expect(elapsed).toBeLessThan(10);
    });
  });

  describe('データ整合性', () => {
    test('statusがactive/settled/completed以外は保存できない', () => {
      const invalidSession = {
        ...mockSession,
        status: 'invalid' as any
      };

      // SQLiteのCHECK制約によりエラーになるはず
      expect(() => {
        dbService.saveSession(invalidSession);
      }).toThrow();
    });

    test('JSON形式でデータが正しく保存・復元される', () => {
      dbService.saveSession(mockSession);
      const retrieved = dbService.getSession(mockSession.groupId);

      // 配列が正しく復元されているか
      expect(Array.isArray(retrieved?.members)).toBe(true);
      expect(Array.isArray(retrieved?.payments)).toBe(true);

      // 内容が一致するか
      expect(retrieved?.members[0].userId).toBe(mockSession.members[0].userId);
      expect(retrieved?.payments[0].amount).toBe(mockSession.payments[0].amount);
    });
  });

  describe('分析イベント記録', () => {
    test('分析イベントを記録できる', () => {
      expect(() => {
        dbService.logAnalyticsEvent({
          eventType: 'payment',
          groupId: 'test-group',
          userId: 'test-user',
          sessionId: 'test-session',
          amount: 5000,
          label: 'テスト支払い'
        });
      }).not.toThrow();
    });

    test('分析イベント記録エラーはメイン処理に影響しない', () => {
      // 不正なデータでも例外を投げない
      expect(() => {
        dbService.logAnalyticsEvent({
          eventType: 'test',
          metadata: { circular: {} }
        });
      }).not.toThrow();
    });
  });

  describe('ユーザーセッション取得（getUserSessions）', () => {
    beforeEach(() => {
      // テスト用セッションを準備
      const sessions: Session[] = [
        createMockSession('group-001', {
          status: 'completed',
          members: [
            createMockMember('U123', 'ユーザーA'),
            createMockMember('U456', 'ユーザーB')
          ],
          payments: [
            createMockPayment('pay001', 1, 'U123', 'ユーザーA', '一軒目', 5000, ['U123', 'U456'])
          ],
          createdAt: new Date('2026-01-20').toISOString()
        }),
        createMockSession('group-002', {
          status: 'completed',
          members: [
            createMockMember('U123', 'ユーザーA'),
            createMockMember('U789', 'ユーザーC')
          ],
          payments: [
            createMockPayment('pay002', 1, 'U123', 'ユーザーA', '二軒目', 3000, ['U123', 'U789'])
          ],
          createdAt: new Date('2026-01-15').toISOString()
        }),
        createMockSession('group-003', {
          status: 'completed',
          members: [
            createMockMember('U1234567', 'ユーザーD'), // U123を含むが別人
          ],
          payments: [],
          createdAt: new Date('2026-01-10').toISOString()
        }),
        createMockSession('group-004', {
          status: 'active', // activeは含まれない
          members: [
            createMockMember('U123', 'ユーザーA'),
          ],
          payments: [],
          createdAt: new Date('2026-01-25').toISOString()
        })
      ];

      dbService.batchSaveSessions(sessions);
    });

    test('正常: ユーザーIDで正確にセッションを取得', () => {
      const sessions = dbService.getUserSessions('U123');

      // U123が参加した2件のみ（U1234567は除外）
      expect(sessions.length).toBe(2);
      expect(sessions[0].groupId).toBe('group-001'); // 新しい順
      expect(sessions[1].groupId).toBe('group-002');
    });

    test('正常: デフォルトで3件取得', () => {
      const sessions = dbService.getUserSessions('U123');
      expect(sessions.length).toBeLessThanOrEqual(3);
    });

    test('正常: limit指定で件数制限', () => {
      const sessions = dbService.getUserSessions('U123', { limit: 1 });
      expect(sessions.length).toBe(1);
      expect(sessions[0].groupId).toBe('group-001'); // 最新のみ
    });

    test('異常: 無効なuserId（空文字）', () => {
      const sessions = dbService.getUserSessions('');
      expect(sessions).toEqual([]);
    });

    test('異常: 無効なuserId（null）', () => {
      const sessions = dbService.getUserSessions(null as any);
      expect(sessions).toEqual([]);
    });

    test('異常: 無効なlimit（0）', () => {
      const sessions = dbService.getUserSessions('U123', { limit: 0 });
      expect(sessions).toEqual([]);
    });

    test('異常: 無効なlimit（101）', () => {
      const sessions = dbService.getUserSessions('U123', { limit: 101 });
      expect(sessions).toEqual([]);
    });

    test('異常: 無効なlimit（小数）', () => {
      const sessions = dbService.getUserSessions('U123', { limit: 1.5 });
      expect(sessions).toEqual([]);
    });

    test('異常: 無効なmonths（0）', () => {
      const sessions = dbService.getUserSessions('U123', { months: 0 });
      expect(sessions).toEqual([]);
    });

    test('異常: 無効なmonths（13）', () => {
      const sessions = dbService.getUserSessions('U123', { months: 13 });
      expect(sessions).toEqual([]);
    });

    test('セキュリティ: userIdの部分一致を防ぐ', () => {
      // U123 と U1234567 は別人として扱われるべき
      const sessionsU123 = dbService.getUserSessions('U123');
      const sessionsU1234567 = dbService.getUserSessions('U1234567');

      expect(sessionsU123.length).toBe(2);
      expect(sessionsU1234567.length).toBe(1);
      expect(sessionsU1234567[0].groupId).toBe('group-003');
    });

    test('activeセッションは含まれない', () => {
      const sessions = dbService.getUserSessions('U123');

      // group-004はactiveなので含まれない
      const hasActiveSession = sessions.some(s => s.groupId === 'group-004');
      expect(hasActiveSession).toBe(false);
    });

    test('存在しないuserIdは空配列を返す', () => {
      const sessions = dbService.getUserSessions('U99999');
      expect(sessions).toEqual([]);
    });
  });

  describe('ユーザー統計取得（getUserStats）', () => {
    beforeEach(() => {
      // テスト用セッションを準備
      const sessions: Session[] = [
        createMockSession('group-001', {
          status: 'completed',
          members: [
            createMockMember('U123', 'ユーザーA'),
            createMockMember('U456', 'ユーザーB')
          ],
          payments: [
            createMockPayment('pay001', 1, 'U123', 'ユーザーA', '一軒目', 5000, ['U123', 'U456']),
            createMockPayment('pay002', 2, 'U456', 'ユーザーB', '二軒目', 3000, ['U123', 'U456'])
          ],
          createdAt: new Date('2026-01-20').toISOString()
        }),
        createMockSession('group-002', {
          status: 'completed',
          members: [
            createMockMember('U123', 'ユーザーA')
          ],
          payments: [
            createMockPayment('pay003', 1, 'U123', 'ユーザーA', 'ランチ', 2000, ['U123'])
          ],
          createdAt: new Date('2025-12-15').toISOString() // 先月
        }),
        createMockSession('group-003', {
          status: 'completed',
          members: [
            createMockMember('U123', 'ユーザーA')
          ],
          payments: [
            createMockPayment('pay004', 1, 'U123', 'ユーザーA', 'ディナー', 8000, ['U123']),
            createMockPayment('pay005', 2, 'U123', 'ユーザーA', 'タクシー', 1500, ['U123'])
          ],
          createdAt: new Date('2026-01-10').toISOString()
        })
      ];

      // 削除済みフラグを手動で設定
      sessions[2].payments[1].isDeleted = true;

      dbService.batchSaveSessions(sessions);
    });

    test('正常: ユーザーの統計を取得（割り勘負担額）', () => {
      const stats = dbService.getUserStats('U123');

      expect(stats.totalSessions).toBe(3); // 全3セッション
      // group-001: 8000/2=4000, group-002: 2000/1=2000, group-003: 8000/1=8000
      expect(stats.totalShare).toBe(14000);
    });

    test('削除済みの支払いは集計しない', () => {
      const stats = dbService.getUserStats('U123');

      // pay005(1500円)は削除済みなので、group-003は8000/1=8000円
      expect(stats.totalShare).toBe(14000); // 14000 + 1500 ではない
    });

    test('割り勘計算：他のユーザーの支払いも含めて計算', () => {
      const stats = dbService.getUserStats('U123');

      // group-001: U123が5000円、U456が3000円払った
      // 割り勘なので U123の負担は (5000+3000)/2 = 4000円
      expect(stats.totalShare).toBe(14000);
    });

    test('異常: 無効なuserId（空文字）', () => {
      const stats = dbService.getUserStats('');

      expect(stats.totalSessions).toBe(0);
      expect(stats.totalShare).toBe(0);
    });

    test('異常: 無効なuserId（null）', () => {
      const stats = dbService.getUserStats(null as any);

      expect(stats.totalSessions).toBe(0);
      expect(stats.totalShare).toBe(0);
    });

    test('存在しないuserIdは0を返す', () => {
      const stats = dbService.getUserStats('U99999');

      expect(stats.totalSessions).toBe(0);
      expect(stats.totalShare).toBe(0);
      expect(stats.thisMonthSessions).toBe(0);
      expect(stats.thisMonthShare).toBe(0);
    });

    test('セキュリティ: userIdの部分一致を防ぐ', () => {
      // U123とU1234567が混同されないこと
      const statsU123 = dbService.getUserStats('U123');
      const statsU1234567 = dbService.getUserStats('U1234567');

      expect(statsU123.totalSessions).toBeGreaterThan(0);
      expect(statsU1234567.totalSessions).toBe(0);
    });
  });
});
