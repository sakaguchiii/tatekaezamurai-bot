/**
 * DatabaseService ユニットテスト
 */

import * as fs from 'fs';
import * as path from 'path';
import { DatabaseService } from '../../services/databaseService';
import { Session } from '../../types';
import { createMockSession, createMockPayment } from '../helpers/mockData';

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
    // 各テストの前にDBをクリーンアップ
    if (fs.existsSync(testDbPath)) {
      fs.unlinkSync(testDbPath);
    }
    if (fs.existsSync(`${testDbPath}-wal`)) {
      fs.unlinkSync(`${testDbPath}-wal`);
    }
    if (fs.existsSync(`${testDbPath}-shm`)) {
      fs.unlinkSync(`${testDbPath}-shm`);
    }
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
});
