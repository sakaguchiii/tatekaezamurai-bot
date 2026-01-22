import * as fs from 'fs';
import * as path from 'path';
import * as cron from 'node-cron';
import { databaseService } from './databaseService';
import { Session } from '../types';

const DATA_DIR = path.join(__dirname, '../data');
const BACKUP_DIR = path.join(DATA_DIR, 'backups');
const DB_PATH = path.join(DATA_DIR, 'database.db');

/**
 * バックアップサービス
 *
 * 機能:
 * - 毎日自動でJSONバックアップを作成
 * - 古いバックアップを自動削除（7日以上前）
 * - SQLiteのWALチェックポイント実行
 * - データ整合性チェック
 */
export class BackupService {
  private cronJob?: cron.ScheduledTask;
  private readonly BACKUP_RETENTION_DAYS = 7;
  private readonly BACKUP_SCHEDULE = '0 3 * * *'; // 毎日午前3時

  constructor() {
    // バックアップディレクトリが存在しない場合は作成
    if (!fs.existsSync(BACKUP_DIR)) {
      fs.mkdirSync(BACKUP_DIR, { recursive: true });
      console.log('📁 バックアップディレクトリを作成:', BACKUP_DIR);
    }
  }

  /**
   * 自動バックアップを開始
   */
  start(): void {
    // 既に起動している場合は何もしない
    if (this.cronJob) {
      console.log('⚠️ バックアップサービスは既に起動しています');
      return;
    }

    console.log('⏰ 自動バックアップを開始します');
    console.log(`📅 スケジュール: ${this.BACKUP_SCHEDULE} (毎日午前3時)`);

    // Cronジョブを設定
    this.cronJob = cron.schedule(this.BACKUP_SCHEDULE, () => {
      console.log('🔄 定期バックアップを開始...');
      this.executeBackup();
    });

    // 起動時に1回実行（初回バックアップ）
    this.checkAndCreateInitialBackup();
  }

  /**
   * 自動バックアップを停止
   */
  stop(): void {
    if (this.cronJob) {
      this.cronJob.stop();
      this.cronJob = undefined;
      console.log('⏹️ 自動バックアップを停止しました');
    }
  }

  /**
   * 初回起動時のバックアップチェック
   */
  private checkAndCreateInitialBackup(): void {
    try {
      const today = new Date().toISOString().split('T')[0];
      const backupFile = path.join(BACKUP_DIR, `sessions_${today}.json`);

      // 今日のバックアップが既に存在する場合はスキップ
      if (fs.existsSync(backupFile)) {
        console.log('✅ 今日のバックアップは既に存在します');
        return;
      }

      console.log('💾 初回バックアップを作成します...');
      this.executeBackup();
    } catch (error) {
      console.error('⚠️ 初回バックアップチェックエラー:', error);
    }
  }

  /**
   * バックアップを実行
   */
  executeBackup(): boolean {
    try {
      const startTime = Date.now();

      // 1. JSONバックアップ作成
      const jsonBackupSuccess = this.createJSONBackup();

      // 2. SQLiteのWALチェックポイント実行
      this.checkpointWAL();

      // 3. 古いバックアップを削除
      this.cleanOldBackups();

      // 4. データ整合性チェック
      this.verifyDataIntegrity();

      const elapsed = Date.now() - startTime;
      console.log(`✅ バックアップ完了 (所要時間: ${elapsed}ms)`);

      return jsonBackupSuccess;
    } catch (error) {
      console.error('❌ バックアップ実行エラー:', error);
      return false;
    }
  }

  /**
   * JSONバックアップを作成
   */
  private createJSONBackup(): boolean {
    try {
      const today = new Date().toISOString().split('T')[0];
      const backupFile = path.join(BACKUP_DIR, `sessions_${today}.json`);

      // 今日のバックアップが既に存在する場合はスキップ
      if (fs.existsSync(backupFile)) {
        console.log('📋 今日のバックアップは既に存在します');
        return true;
      }

      // 全セッションをJSONエクスポート
      const allSessions = databaseService.getAllSessions();
      const sessionsObj: { [groupId: string]: Session } = {};

      allSessions.forEach(session => {
        sessionsObj[session.groupId] = session;
      });

      // JSON形式で保存
      fs.writeFileSync(backupFile, JSON.stringify(sessionsObj, null, 2), 'utf-8');

      // ファイルサイズを取得
      const stats = fs.statSync(backupFile);
      const sizeKB = (stats.size / 1024).toFixed(2);

      console.log(`💾 JSONバックアップを作成: ${backupFile}`);
      console.log(`📊 セッション数: ${allSessions.length}, サイズ: ${sizeKB} KB`);

      return true;
    } catch (error) {
      console.error('❌ JSONバックアップ作成エラー:', error);
      return false;
    }
  }

  /**
   * SQLiteのWALチェックポイント実行
   * （WALファイルを本体にマージしてディスク使用量を削減）
   */
  private checkpointWAL(): void {
    try {
      // WALファイルのパス
      const walFile = `${DB_PATH}-wal`;

      // WALファイルが存在するかチェック
      if (!fs.existsSync(walFile)) {
        return;
      }

      const beforeSize = fs.statSync(walFile).size;

      // チェックポイント実行（データベースサービス経由）
      console.log('🔄 WALチェックポイントを実行中...');
      databaseService.checkpoint();

      const afterSize = fs.existsSync(walFile) ? fs.statSync(walFile).size : 0;
      const reducedKB = ((beforeSize - afterSize) / 1024).toFixed(2);

      console.log(`✅ WALチェックポイント完了 (削減: ${reducedKB} KB)`);
    } catch (error) {
      console.error('⚠️ WALチェックポイントエラー:', error);
      // エラーが出てもバックアップは続行
    }
  }

  /**
   * 古いバックアップを削除
   */
  private cleanOldBackups(): void {
    try {
      const files = fs.readdirSync(BACKUP_DIR);
      const cutoffDate = new Date();
      cutoffDate.setDate(cutoffDate.getDate() - this.BACKUP_RETENTION_DAYS);

      let deletedCount = 0;

      files.forEach(file => {
        // sessions_で始まるJSONファイルのみ対象
        if (!file.startsWith('sessions_') || !file.endsWith('.json')) {
          return;
        }

        const filePath = path.join(BACKUP_DIR, file);
        const stats = fs.statSync(filePath);

        if (stats.mtime < cutoffDate) {
          fs.unlinkSync(filePath);
          deletedCount++;
          console.log(`🗑️ 古いバックアップを削除: ${file}`);
        }
      });

      if (deletedCount === 0) {
        console.log('📋 削除対象の古いバックアップはありません');
      } else {
        console.log(`✅ ${deletedCount}件の古いバックアップを削除しました`);
      }
    } catch (error) {
      console.error('⚠️ 古いバックアップの削除エラー:', error);
    }
  }

  /**
   * データ整合性チェック
   */
  private verifyDataIntegrity(): void {
    try {
      const allSessions = databaseService.getAllSessions();

      let issueCount = 0;

      // 基本的な整合性チェック
      allSessions.forEach(session => {
        // 必須フィールドのチェック
        if (!session.groupId || !session.status) {
          console.warn(`⚠️ 不正なセッションデータ: ${session.groupId}`);
          issueCount++;
        }

        // 配列フィールドのチェック
        if (!Array.isArray(session.members) || !Array.isArray(session.payments)) {
          console.warn(`⚠️ 不正な配列データ: ${session.groupId}`);
          issueCount++;
        }

        // ステータスのチェック
        const validStatuses = ['active', 'settled', 'completed'];
        if (!validStatuses.includes(session.status)) {
          console.warn(`⚠️ 不正なステータス: ${session.groupId} - ${session.status}`);
          issueCount++;
        }
      });

      if (issueCount === 0) {
        console.log('✅ データ整合性チェック: 問題なし');
      } else {
        console.warn(`⚠️ データ整合性チェック: ${issueCount}件の問題を検出`);
      }
    } catch (error) {
      console.error('❌ データ整合性チェックエラー:', error);
    }
  }

  /**
   * 手動バックアップ（緊急時用）
   */
  async manualBackup(): Promise<boolean> {
    console.log('🆘 手動バックアップを実行します...');
    return this.executeBackup();
  }

  /**
   * バックアップ一覧を取得
   */
  listBackups(): Array<{ file: string; date: string; size: number }> {
    try {
      const files = fs.readdirSync(BACKUP_DIR);

      return files
        .filter(file => file.startsWith('sessions_') && file.endsWith('.json'))
        .map(file => {
          const filePath = path.join(BACKUP_DIR, file);
          const stats = fs.statSync(filePath);

          return {
            file,
            date: stats.mtime.toISOString(),
            size: stats.size
          };
        })
        .sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime());
    } catch (error) {
      console.error('❌ バックアップ一覧取得エラー:', error);
      return [];
    }
  }

  /**
   * 最新のバックアップから復元（緊急時用）
   */
  async restoreFromLatestBackup(): Promise<boolean> {
    try {
      const backups = this.listBackups();

      if (backups.length === 0) {
        console.error('❌ 復元可能なバックアップがありません');
        return false;
      }

      const latestBackup = backups[0];
      const backupPath = path.join(BACKUP_DIR, latestBackup.file);

      console.log(`♻️ バックアップから復元: ${latestBackup.file}`);

      // JSONファイルを読み込み
      const data = fs.readFileSync(backupPath, 'utf-8');
      const sessions = JSON.parse(data);
      const sessionArray = Object.values(sessions) as Session[];

      // データベースに一括保存
      databaseService.batchSaveSessions(sessionArray);

      console.log(`✅ ${sessionArray.length}件のセッションを復元しました`);
      return true;
    } catch (error) {
      console.error('❌ バックアップからの復元エラー:', error);
      return false;
    }
  }
}

// シングルトンインスタンス
export const backupService = new BackupService();
