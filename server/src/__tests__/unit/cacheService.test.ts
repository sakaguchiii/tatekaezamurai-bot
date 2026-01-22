/**
 * CacheService ユニットテスト
 */

import { CacheService } from '../../services/cacheService';
import { Session } from '../../types';
import { createMockSession, createMockPayment } from '../helpers/mockData';

// DatabaseServiceのモック
jest.mock('../../services/databaseService', () => ({
  databaseService: {
    getSession: jest.fn(),
    saveSession: jest.fn(),
    batchSaveSessions: jest.fn()
  }
}));

import { databaseService } from '../../services/databaseService';

describe('CacheService', () => {
  let cacheService: CacheService;

  // テスト用のセッションデータ
  const mockSession: Session = createMockSession('test-group-001', {
    payments: [
      createMockPayment('pay001', 1, 'user001', 'テストユーザー1', '一軒目', 5000, ['user001'])
    ]
  });

  beforeEach(() => {
    // 各テストの前にキャッシュをクリア
    cacheService = new CacheService();
    cacheService.clear();

    // モックをリセット
    jest.clearAllMocks();
  });

  describe('基本操作', () => {
    test('セッションを作成できる', () => {
      cacheService.createSession(mockSession);

      // DBに即座に保存されるべき
      expect(databaseService.saveSession).toHaveBeenCalledWith(mockSession);

      // キャッシュから取得できる
      const retrieved = cacheService.getSession(mockSession.groupId);
      expect(retrieved).not.toBeNull();
      expect(retrieved?.groupId).toBe(mockSession.groupId);
    });

    test('セッションを取得できる（キャッシュヒット）', () => {
      cacheService.createSession(mockSession);

      const retrieved = cacheService.getSession(mockSession.groupId);

      expect(retrieved).not.toBeNull();
      expect(retrieved?.groupId).toBe(mockSession.groupId);

      // DBからは取得していない（キャッシュヒット）
      expect(databaseService.getSession).not.toHaveBeenCalled();
    });

    test('セッションを取得できる（キャッシュミス → DB取得）', () => {
      // DBから返すモック設定
      (databaseService.getSession as jest.Mock).mockReturnValue(mockSession);

      const retrieved = cacheService.getSession(mockSession.groupId);

      // DBから取得された
      expect(databaseService.getSession).toHaveBeenCalledWith(mockSession.groupId);
      expect(retrieved).not.toBeNull();

      // 2回目はキャッシュヒット
      jest.clearAllMocks();
      cacheService.getSession(mockSession.groupId);
      expect(databaseService.getSession).not.toHaveBeenCalled();
    });

    test('存在しないセッションはnullを返す', () => {
      (databaseService.getSession as jest.Mock).mockReturnValue(null);

      const retrieved = cacheService.getSession('non-existent-group');
      expect(retrieved).toBeNull();
    });
  });

  describe('更新操作', () => {
    test('セッションを更新できる', () => {
      cacheService.createSession(mockSession);
      jest.clearAllMocks();

      // 更新
      cacheService.updateSession(mockSession.groupId, {
        status: 'settled'
      });

      // キャッシュが即座に更新される
      const retrieved = cacheService.getSession(mockSession.groupId);
      expect(retrieved?.status).toBe('settled');
    });

    test('更新時にDB書き込みがキューイングされる', async () => {
      cacheService.createSession(mockSession);
      jest.clearAllMocks();

      cacheService.updateSession(mockSession.groupId, {
        status: 'settled'
      });

      // 少し待つ（フラッシュ待ち）
      await new Promise(resolve => setTimeout(resolve, 150));

      // バッチ書き込みが実行された
      expect(databaseService.batchSaveSessions).toHaveBeenCalled();
    });

    test('複数の更新がバッチ処理される', async () => {
      cacheService.createSession(mockSession);
      jest.clearAllMocks();

      // 連続して更新
      cacheService.updateSession(mockSession.groupId, { status: 'settled' });
      cacheService.updateSession(mockSession.groupId, { status: 'completed' });

      // フラッシュ待ち
      await new Promise(resolve => setTimeout(resolve, 150));

      // 1回のバッチ書き込みで処理される
      expect(databaseService.batchSaveSessions).toHaveBeenCalledTimes(1);
    });
  });

  describe('セッション終了', () => {
    test('セッションを終了できる', () => {
      cacheService.createSession(mockSession);
      jest.clearAllMocks();

      cacheService.endSession(mockSession.groupId);

      // DBに即座に保存される
      expect(databaseService.saveSession).toHaveBeenCalled();

      // キャッシュから削除される
      const retrieved = cacheService.getSession(mockSession.groupId);
      expect(retrieved).toBeNull();
    });
  });

  describe('パフォーマンス', () => {
    test('キャッシュヒット時の取得が1ms以内に完了する', () => {
      cacheService.createSession(mockSession);

      const startTime = Date.now();
      cacheService.getSession(mockSession.groupId);
      const elapsed = Date.now() - startTime;

      expect(elapsed).toBeLessThan(1);
    });

    test('更新が5ms以内に完了する（非同期書き込み）', () => {
      cacheService.createSession(mockSession);

      const startTime = Date.now();
      cacheService.updateSession(mockSession.groupId, { status: 'settled' });
      const elapsed = Date.now() - startTime;

      expect(elapsed).toBeLessThan(5);
    });
  });

  describe('キャッシュ統計', () => {
    test('キャッシュサイズを取得できる', () => {
      cacheService.createSession(mockSession);

      const stats = cacheService.getStats();
      expect(stats.size).toBe(1);
      expect(stats.queueSize).toBe(0);
    });

    test('キュー統計を取得できる', async () => {
      cacheService.createSession(mockSession);
      cacheService.updateSession(mockSession.groupId, { status: 'settled' });

      const stats = cacheService.getStats();
      expect(stats.queueSize).toBeGreaterThan(0);

      // フラッシュ後はキューが空になる
      await new Promise(resolve => setTimeout(resolve, 150));
      const statsAfter = cacheService.getStats();
      expect(statsAfter.queueSize).toBe(0);
    });
  });

  describe('キャッシュクリア', () => {
    test('キャッシュをクリアできる', () => {
      cacheService.createSession(mockSession);
      cacheService.clear();

      // キャッシュから取得できない
      (databaseService.getSession as jest.Mock).mockReturnValue(null);
      const retrieved = cacheService.getSession(mockSession.groupId);
      expect(retrieved).toBeNull();
    });
  });

  describe('強制フラッシュ', () => {
    test('強制フラッシュが実行できる', async () => {
      cacheService.createSession(mockSession);
      jest.clearAllMocks();

      cacheService.updateSession(mockSession.groupId, { status: 'settled' });

      // 即座にフラッシュ
      await cacheService.forceFlush();

      // バッチ書き込みが実行された
      expect(databaseService.batchSaveSessions).toHaveBeenCalled();
    });
  });

  describe('エラーハンドリング', () => {
    test('存在しないセッションの更新は警告のみ', () => {
      const consoleSpy = jest.spyOn(console, 'warn').mockImplementation();

      cacheService.updateSession('non-existent', { status: 'settled' });

      expect(consoleSpy).toHaveBeenCalled();
      consoleSpy.mockRestore();
    });

    test('DB書き込みエラー時にキューに戻す', async () => {
      cacheService.createSession(mockSession);
      jest.clearAllMocks();

      // DB書き込みでエラーを発生させる
      (databaseService.batchSaveSessions as jest.Mock).mockImplementation(() => {
        throw new Error('DB Error');
      });

      cacheService.updateSession(mockSession.groupId, { status: 'settled' });

      await new Promise(resolve => setTimeout(resolve, 150));

      // キューに残っている（リトライ可能）
      const stats = cacheService.getStats();
      expect(stats.queueSize).toBeGreaterThan(0);
    });
  });
});
