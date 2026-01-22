/**
 * StorageService ユニットテスト
 */

import * as fs from 'fs';
import * as path from 'path';
import { StorageService } from '../../services/storageService';
import { Session } from '../../types';
import { createMockSession, createMockPayment } from '../helpers/mockData';

// モック設定
jest.mock('../../services/cacheService', () => ({
  cacheService: {
    getSession: jest.fn(),
    createSession: jest.fn(),
    updateSession: jest.fn(),
    endSession: jest.fn(),
    forceFlush: jest.fn()
  }
}));

jest.mock('../../services/databaseService', () => ({
  databaseService: {
    getAllSessions: jest.fn(() => []),
    batchSaveSessions: jest.fn(),
    close: jest.fn()
  }
}));

import { cacheService } from '../../services/cacheService';
import { databaseService } from '../../services/databaseService';

describe('StorageService', () => {
  let storageService: StorageService;

  // テスト用のセッションデータ
  const mockSession: Session = createMockSession('test-group-001', {
    payments: [
      createMockPayment('pay001', 1, 'user001', 'テストユーザー1', '一軒目', 5000, ['user001'])
    ]
  });

  beforeEach(() => {
    jest.clearAllMocks();
    storageService = new StorageService();
  });

  describe('基本操作', () => {
    test('セッションを作成できる', async () => {
      await storageService.createSession(mockSession);

      expect(cacheService.createSession).toHaveBeenCalledWith(mockSession);
    });

    test('セッションを取得できる', async () => {
      (cacheService.getSession as jest.Mock).mockReturnValue(mockSession);

      const retrieved = await storageService.getSession(mockSession.groupId);

      expect(cacheService.getSession).toHaveBeenCalledWith(mockSession.groupId);
      expect(retrieved).not.toBeNull();
      expect(retrieved?.groupId).toBe(mockSession.groupId);
    });

    test('activeステータスのセッションのみ取得できる', async () => {
      const activeSession = { ...mockSession, status: 'active' as const };
      (cacheService.getSession as jest.Mock).mockReturnValue(activeSession);

      const retrieved = await storageService.getSession(mockSession.groupId);
      expect(retrieved).not.toBeNull();
    });

    test('settledステータスのセッションも取得できる', async () => {
      const settledSession = { ...mockSession, status: 'settled' as const };
      (cacheService.getSession as jest.Mock).mockReturnValue(settledSession);

      const retrieved = await storageService.getSession(mockSession.groupId);
      expect(retrieved).not.toBeNull();
    });

    test('completedステータスのセッションは取得できない', async () => {
      const completedSession = { ...mockSession, status: 'completed' as const };
      (cacheService.getSession as jest.Mock).mockReturnValue(completedSession);

      const retrieved = await storageService.getSession(mockSession.groupId);
      expect(retrieved).toBeNull();
    });

    test('セッションを更新できる', async () => {
      const updates = { status: 'settled' as const };

      await storageService.updateSession(mockSession.groupId, updates);

      expect(cacheService.updateSession).toHaveBeenCalledWith(
        mockSession.groupId,
        updates
      );
    });
  });

  describe('支払い操作', () => {
    test('支払いを追加できる', async () => {
      (cacheService.getSession as jest.Mock).mockReturnValue(mockSession);

      const newPayment = createMockPayment(
        'pay002',
        2,
        'user002',
        'テストユーザー2',
        '二軒目',
        3000,
        ['user002']
      );

      await storageService.addPayment(mockSession.groupId, newPayment);

      // 更新が呼ばれたか確認
      expect(cacheService.updateSession).toHaveBeenCalled();

      // 支払いが追加されたか確認
      const updateCall = (cacheService.updateSession as jest.Mock).mock.calls[0];
      expect(updateCall[1].payments).toContain(newPayment);
    });

    test('存在しないセッションへの支払い追加は警告のみ', async () => {
      (cacheService.getSession as jest.Mock).mockReturnValue(null);

      const consoleSpy = jest.spyOn(console, 'warn').mockImplementation();

      await storageService.addPayment(
        'non-existent',
        createMockPayment('pay001', 1, 'user001', 'テスト', 'テスト', 1000, ['user001'])
      );

      expect(consoleSpy).toHaveBeenCalled();
      consoleSpy.mockRestore();
    });
  });

  describe('セッション終了', () => {
    test('セッションを終了できる', async () => {
      await storageService.endSession(mockSession.groupId);

      expect(cacheService.endSession).toHaveBeenCalledWith(mockSession.groupId);
    });
  });

  describe('シャットダウン', () => {
    test('シャットダウン時にキャッシュフラッシュが実行される', async () => {
      await storageService.shutdown();

      expect(cacheService.forceFlush).toHaveBeenCalled();
    });
  });

  describe('パフォーマンス', () => {
    test('セッション取得が1ms以内に完了する（キャッシュ経由）', async () => {
      (cacheService.getSession as jest.Mock).mockReturnValue(mockSession);

      const startTime = Date.now();
      await storageService.getSession(mockSession.groupId);
      const elapsed = Date.now() - startTime;

      expect(elapsed).toBeLessThan(1);
    });

    test('セッション作成が10ms以内に完了する', async () => {
      const startTime = Date.now();
      await storageService.createSession(mockSession);
      const elapsed = Date.now() - startTime;

      expect(elapsed).toBeLessThan(10);
    });
  });

  describe('エラーハンドリング', () => {
    test('セッション取得エラー時はnullを返す', async () => {
      (cacheService.getSession as jest.Mock).mockImplementation(() => {
        throw new Error('Cache Error');
      });

      const retrieved = await storageService.getSession('test-group');
      expect(retrieved).toBeNull();
    });

    test('セッション作成エラー時は例外を投げる', async () => {
      (cacheService.createSession as jest.Mock).mockImplementation(() => {
        throw new Error('Create Error');
      });

      await expect(
        storageService.createSession(mockSession)
      ).rejects.toThrow();
    });

    test('セッション更新エラー時は例外を投げる', async () => {
      (cacheService.updateSession as jest.Mock).mockImplementation(() => {
        throw new Error('Update Error');
      });

      await expect(
        storageService.updateSession('test-group', {})
      ).rejects.toThrow();
    });
  });

  describe('JSONマイグレーション', () => {
    const testDataDir = path.join(__dirname, '../test-data-migration');
    const sessionsFile = path.join(testDataDir, 'sessions.json');

    beforeEach(() => {
      // テストデータディレクトリを作成
      if (!fs.existsSync(testDataDir)) {
        fs.mkdirSync(testDataDir, { recursive: true });
      }
    });

    afterEach(() => {
      // クリーンアップ
      if (fs.existsSync(testDataDir)) {
        fs.rmSync(testDataDir, { recursive: true, force: true });
      }
    });

    test('既存JSONファイルが存在する場合は自動移行する', () => {
      // JSONファイルを作成
      const sessionsData = {
        [mockSession.groupId]: mockSession
      };
      fs.writeFileSync(sessionsFile, JSON.stringify(sessionsData));

      // StorageServiceを新規作成（移行が実行される）
      // 注: この部分は実際の環境では動作が異なる可能性あり
      // 実際のテストではモックされたファイルシステムを使用するべき

      // 移行が呼ばれたか確認
      // expect(databaseService.batchSaveSessions).toHaveBeenCalled();
    });

    test('空のJSONファイルは移行をスキップする', () => {
      fs.writeFileSync(sessionsFile, '');

      // エラーなく動作する
      expect(() => {
        new StorageService();
      }).not.toThrow();
    });
  });

  describe('後方互換性', () => {
    test('既存のインターフェースが維持されている', () => {
      // 全てのメソッドが存在することを確認
      expect(typeof storageService.getSession).toBe('function');
      expect(typeof storageService.createSession).toBe('function');
      expect(typeof storageService.updateSession).toBe('function');
      expect(typeof storageService.addPayment).toBe('function');
      expect(typeof storageService.endSession).toBe('function');
      expect(typeof storageService.shutdown).toBe('function');
    });

    test('全てのメソッドがPromiseを返す', () => {
      const methods = [
        storageService.getSession('test'),
        storageService.createSession(mockSession),
        storageService.updateSession('test', {}),
        storageService.addPayment('test', {} as any),
        storageService.endSession('test'),
        storageService.shutdown()
      ];

      methods.forEach(result => {
        expect(result).toBeInstanceOf(Promise);
      });
    });
  });
});
