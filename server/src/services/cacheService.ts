import { Session } from '../types';
import { databaseService } from './databaseService';

interface CacheEntry {
  session: Session;
  lastAccess: number; // タイムスタンプ
}

/**
 * メモリキャッシュサービス
 * アクティブセッションをメモリに保持して超高速アクセスを実現
 * 目標: <1ms で読み込み、<5ms で書き込み
 */
export class CacheService {
  private cache: Map<string, CacheEntry> = new Map();
  private writeQueue: Array<{ groupId: string; session: Session }> = [];
  private flushTimer?: NodeJS.Timeout;
  private readonly TTL = 24 * 60 * 60 * 1000; // 24時間（ミリ秒）
  private readonly FLUSH_INTERVAL = 100; // 100ms
  private readonly MAX_CACHE_SIZE = 1000; // 最大1000セッション

  constructor() {
    // 定期的にキャッシュをクリーンアップ（1時間ごと）
    setInterval(() => this.cleanup(), 60 * 60 * 1000);
    console.log('💾 キャッシュサービスを初期化しました');
  }

  /**
   * セッション取得（超高速: <1ms）
   */
  getSession(groupId: string): Session | null {
    // 1. キャッシュから取得
    const cached = this.cache.get(groupId);
    if (cached) {
      // アクセス時刻を更新（LRU用）
      cached.lastAccess = Date.now();
      return cached.session;
    }

    // 2. キャッシュミス: DBから取得してキャッシュに登録
    const session = databaseService.getSession(groupId);
    if (session && session.status === 'active') {
      this.cache.set(groupId, {
        session,
        lastAccess: Date.now()
      });
    }

    return session;
  }

  /**
   * セッション更新（超高速: <5ms）
   * キャッシュを即座に更新し、DBへの書き込みは非同期でバッチ処理
   */
  updateSession(groupId: string, updates: Partial<Session>): void {
    // 1. 既存セッション取得
    let session = this.getSession(groupId);
    if (!session) {
      console.warn('⚠️ セッションが見つかりません:', groupId);
      return;
    }

    // 2. キャッシュを即座に更新
    session = {
      ...session,
      ...updates,
      updatedAt: new Date().toISOString()
    };

    this.cache.set(groupId, {
      session,
      lastAccess: Date.now()
    });

    // 3. 非同期でDB書き込みをキューに追加
    this.queueWrite(groupId, session);
  }

  /**
   * 新規セッション作成
   */
  createSession(session: Session): void {
    // キャッシュに登録
    this.cache.set(session.groupId, {
      session,
      lastAccess: Date.now()
    });

    // 即座にDBに保存（新規作成は重要なので同期的に）
    databaseService.saveSession(session);
  }

  /**
   * セッション終了
   */
  endSession(groupId: string): void {
    const session = this.getSession(groupId);
    if (session) {
      // ステータス更新
      session.status = 'completed';
      session.updatedAt = new Date().toISOString();

      // 即座にDBに保存
      databaseService.saveSession(session);

      // キャッシュから削除（完了したセッションは不要）
      this.cache.delete(groupId);
      console.log(`✅ セッション終了: ${groupId}`);
    }
  }

  /**
   * DB書き込みをキューに追加
   */
  private queueWrite(groupId: string, session: Session): void {
    // 既存のキューから同じgroupIdを削除（最新のみ保持）
    this.writeQueue = this.writeQueue.filter(item => item.groupId !== groupId);

    // キューに追加
    this.writeQueue.push({ groupId, session });

    // フラッシュをスケジュール
    this.scheduleFlush();
  }

  /**
   * フラッシュをスケジュール（100ms後にまとめて書き込み）
   */
  private scheduleFlush(): void {
    if (this.flushTimer) return;

    this.flushTimer = setTimeout(() => {
      this.flush();
    }, this.FLUSH_INTERVAL);
  }

  /**
   * キューをフラッシュ（DBに一括書き込み）
   */
  flush(): void {
    if (this.writeQueue.length === 0) {
      this.flushTimer = undefined;
      return;
    }

    const toWrite = [...this.writeQueue];
    this.writeQueue = [];
    this.flushTimer = undefined;

    try {
      // バッチ書き込み（トランザクション）
      const sessions = toWrite.map(item => item.session);
      databaseService.batchSaveSessions(sessions);
    } catch (error) {
      console.error('❌ フラッシュエラー:', error);
      // エラー時はキューに戻す
      this.writeQueue.push(...toWrite);
    }
  }

  /**
   * キャッシュクリーンアップ
   * - TTLを過ぎたエントリを削除
   * - 最大サイズを超えた場合、古いエントリを削除（LRU）
   */
  private cleanup(): void {
    const now = Date.now();
    let removed = 0;

    // TTLチェック
    for (const [groupId, entry] of this.cache.entries()) {
      if (now - entry.lastAccess > this.TTL) {
        this.cache.delete(groupId);
        removed++;
      }
    }

    // サイズチェック
    if (this.cache.size > this.MAX_CACHE_SIZE) {
      // lastAccessでソートして古いものから削除
      const entries = Array.from(this.cache.entries())
        .sort((a, b) => a[1].lastAccess - b[1].lastAccess);

      const toRemove = entries.slice(0, this.cache.size - this.MAX_CACHE_SIZE);
      toRemove.forEach(([groupId]) => {
        this.cache.delete(groupId);
        removed++;
      });
    }

    if (removed > 0) {
      console.log(`🧹 キャッシュクリーンアップ: ${removed}件削除`);
    }
  }

  /**
   * キャッシュ統計
   */
  getStats(): { size: number; queueSize: number } {
    return {
      size: this.cache.size,
      queueSize: this.writeQueue.length
    };
  }

  /**
   * キャッシュクリア（テスト用）
   */
  clear(): void {
    this.cache.clear();
    this.writeQueue = [];
    if (this.flushTimer) {
      clearTimeout(this.flushTimer);
      this.flushTimer = undefined;
    }
    console.log('🧹 キャッシュをクリアしました');
  }

  /**
   * 強制フラッシュ（終了時など）
   */
  async forceFlush(): Promise<void> {
    if (this.flushTimer) {
      clearTimeout(this.flushTimer);
      this.flushTimer = undefined;
    }
    this.flush();
    console.log('💾 キャッシュを強制フラッシュしました');
  }
}

// シングルトンインスタンス
export const cacheService = new CacheService();
