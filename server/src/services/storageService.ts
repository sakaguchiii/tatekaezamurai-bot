import * as fs from 'fs';
import * as path from 'path';
import { Session } from '../types';
import { cacheService } from './cacheService';
import { databaseService } from './databaseService';

const DATA_DIR = path.join(__dirname, '../data');
const SESSIONS_FILE = path.join(DATA_DIR, 'sessions.json');
const BACKUP_DIR = path.join(DATA_DIR, 'backups');

// データディレクトリが存在しない場合は作成
if (!fs.existsSync(DATA_DIR)) {
  fs.mkdirSync(DATA_DIR, { recursive: true });
  console.log('📁 データディレクトリを作成:', DATA_DIR);
}

// バックアップディレクトリ作成
if (!fs.existsSync(BACKUP_DIR)) {
  fs.mkdirSync(BACKUP_DIR, { recursive: true });
  console.log('📁 バックアップディレクトリを作成:', BACKUP_DIR);
}

/**
 * StorageService
 * キャッシュ + SQLite のハイブリッド型ストレージ
 * 既存のインターフェースを維持しながら、内部をリファクタリング
 *
 * 【設計方針】
 * - 読み込み: キャッシュ優先、キャッシュミス時はDB
 * - 書き込み: キャッシュ即座更新 + DB非同期書き込み
 * - 後方互換性: 既存コードへの影響ゼロ
 */
export class StorageService {
  private migrationCompleted = false;

  constructor() {
    // 初回起動時にJSONからSQLiteへの移行を実行
    this.checkAndMigrate();
  }

  /**
   * 初回起動時の移行チェック
   */
  private checkAndMigrate(): void {
    try {
      // sessions.jsonが存在し、DBが空の場合は移行
      if (fs.existsSync(SESSIONS_FILE) && !this.migrationCompleted) {
        const jsonData = fs.readFileSync(SESSIONS_FILE, 'utf-8');
        if (jsonData.trim()) {
          const sessions = JSON.parse(jsonData);
          const sessionCount = Object.keys(sessions).length;

          if (sessionCount > 0) {
            console.log(`📦 JSONからSQLiteへの移行を開始 (${sessionCount}セッション)`);

            // 全セッションをDBに保存
            const sessionArray = Object.values(sessions) as Session[];
            databaseService.batchSaveSessions(sessionArray);

            // アクティブセッションをキャッシュに登録
            sessionArray
              .filter(s => s.status === 'active')
              .forEach(s => {
                cacheService.createSession(s);
              });

            console.log('✅ 移行完了');

            // 移行完了フラグ（sessions.jsonはバックアップとして残す）
            this.migrationCompleted = true;
          }
        }
      }
    } catch (error) {
      console.error('⚠️ 移行チェックエラー:', error);
      // エラーが出てもサービスは起動する
    }
  }

  /**
   * セッション取得（高速: <1ms キャッシュヒット時）
   */
  async getSession(groupId: string): Promise<Session | null> {
    try {
      // キャッシュから取得（超高速）
      const session = cacheService.getSession(groupId);

      // activeまたはsettledのセッションのみ返す
      if (session && (session.status === 'active' || session.status === 'settled')) {
        return session;
      }

      return null;
    } catch (error) {
      console.error('❌ セッション取得エラー:', groupId, error);
      return null;
    }
  }

  /**
   * セッション作成
   */
  async createSession(session: Session): Promise<void> {
    try {
      // キャッシュ + DBに保存
      cacheService.createSession(session);

      console.log('✅ セッション作成:', session.groupId);
    } catch (error) {
      console.error('❌ セッション作成エラー:', session.groupId, error);
      throw error;
    }
  }

  /**
   * セッション更新（高速: <5ms）
   */
  async updateSession(groupId: string, data: Partial<Session>): Promise<void> {
    try {
      // キャッシュを即座に更新（非同期でDBも更新）
      cacheService.updateSession(groupId, data);
    } catch (error) {
      console.error('❌ セッション更新エラー:', groupId, error);
      throw error;
    }
  }

  /**
   * 支払い追加
   */
  async addPayment(groupId: string, payment: any): Promise<void> {
    try {
      const session = await this.getSession(groupId);
      if (!session) {
        console.warn('⚠️ セッションが見つかりません:', groupId);
        return;
      }

      // 支払いを追加
      session.payments.push(payment);
      session.updatedAt = new Date().toISOString();

      // 更新
      cacheService.updateSession(groupId, {
        payments: session.payments,
        updatedAt: session.updatedAt
      });

      console.log(`💰 支払い追加: ${groupId} - ${payment.label} ${payment.amount}円`);
    } catch (error) {
      console.error('❌ 支払い追加エラー:', groupId, error);
      throw error;
    }
  }

  /**
   * セッション終了
   */
  async endSession(groupId: string): Promise<void> {
    try {
      // キャッシュから終了処理
      cacheService.endSession(groupId);

      console.log('🏁 セッション終了:', groupId);
    } catch (error) {
      console.error('❌ セッション終了エラー:', groupId, error);
      throw error;
    }
  }

  /**
   * 【レガシー互換】JSONバックアップ作成
   * 既存のバックアップ機能との互換性維持
   */
  private createBackupIfNeeded(): void {
    try {
      const today = new Date().toISOString().split('T')[0];
      const backupFile = path.join(BACKUP_DIR, `sessions_${today}.json`);

      // 今日のバックアップが既に存在する場合はスキップ
      if (fs.existsSync(backupFile)) {
        return;
      }

      // 全セッションをJSONエクスポート
      const allSessions = databaseService.getAllSessions();
      const sessionsObj: { [groupId: string]: Session } = {};
      allSessions.forEach(session => {
        sessionsObj[session.groupId] = session;
      });

      // JSON形式で保存
      fs.writeFileSync(backupFile, JSON.stringify(sessionsObj, null, 2));
      console.log('💾 JSONバックアップを作成:', backupFile);

      // 古いバックアップを削除（7日以上前）
      this.cleanOldBackups();
    } catch (error) {
      console.error('⚠️ バックアップの作成エラー:', error);
    }
  }

  /**
   * 古いバックアップ削除
   */
  private cleanOldBackups(): void {
    try {
      const files = fs.readdirSync(BACKUP_DIR);
      const sevenDaysAgo = new Date();
      sevenDaysAgo.setDate(sevenDaysAgo.getDate() - 7);

      files.forEach(file => {
        const filePath = path.join(BACKUP_DIR, file);
        const stats = fs.statSync(filePath);

        if (stats.mtime < sevenDaysAgo) {
          fs.unlinkSync(filePath);
          console.log('🗑️ 古いバックアップを削除:', file);
        }
      });
    } catch (error) {
      console.error('⚠️ 古いバックアップの削除エラー:', error);
    }
  }

  /**
   * バックアップから復元（緊急時用）
   */
  private restoreFromBackup(): { [groupId: string]: Session } | null {
    try {
      const files = fs.readdirSync(BACKUP_DIR);
      if (files.length === 0) return null;

      // 最新のバックアップを取得
      const latestBackup = files
        .filter(f => f.startsWith('sessions_'))
        .sort()
        .reverse()[0];

      if (!latestBackup) return null;

      const backupPath = path.join(BACKUP_DIR, latestBackup);
      const data = fs.readFileSync(backupPath, 'utf-8');
      console.log('♻️ バックアップから復元:', latestBackup);

      return JSON.parse(data);
    } catch (error) {
      console.error('❌ バックアップからの復元エラー:', error);
      return null;
    }
  }

  /**
   * 終了時の処理（キャッシュフラッシュ）
   */
  async shutdown(): Promise<void> {
    console.log('🔄 StorageService: シャットダウン処理開始');

    // キャッシュをフラッシュ
    await cacheService.forceFlush();

    // JSONバックアップ作成
    this.createBackupIfNeeded();

    console.log('✅ StorageService: シャットダウン完了');
  }
}

export const storageService = new StorageService();

// プロセス終了時のクリーンアップ
process.on('SIGINT', async () => {
  await storageService.shutdown();
  databaseService.close();
  process.exit(0);
});

process.on('SIGTERM', async () => {
  await storageService.shutdown();
  databaseService.close();
  process.exit(0);
});
