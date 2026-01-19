import * as fs from 'fs';
import * as path from 'path';
import { Session } from '../types';

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

// sessions.jsonが存在しない場合は作成
if (!fs.existsSync(SESSIONS_FILE)) {
  fs.writeFileSync(SESSIONS_FILE, JSON.stringify({}, null, 2));
  console.log('📄 セッションファイルを作成:', SESSIONS_FILE);
}

export class StorageService {
  private isWriting = false; // 書き込み中フラグ

  // 全セッション取得
  private getAllSessions(): { [groupId: string]: Session } {
    try {
      if (!fs.existsSync(SESSIONS_FILE)) {
        console.warn('⚠️ セッションファイルが見つかりません。新規作成します');
        fs.writeFileSync(SESSIONS_FILE, JSON.stringify({}, null, 2));
        return {};
      }

      const data = fs.readFileSync(SESSIONS_FILE, 'utf-8');
      if (!data.trim()) {
        console.warn('⚠️ セッションファイルが空です');
        return {};
      }

      return JSON.parse(data);
    } catch (error) {
      console.error('❌ セッションファイルの読み込みエラー:', error);
      // バックアップから復元を試みる
      return this.restoreFromBackup() || {};
    }
  }

  // 全セッション保存（ファイルロック考慮）
  private async saveAllSessions(sessions: { [groupId: string]: Session }): Promise<void> {
    // 書き込み中の場合は待機
    while (this.isWriting) {
      await new Promise(resolve => setTimeout(resolve, 50));
    }

    this.isWriting = true;

    try {
      // バックアップ作成（1日1回）
      this.createBackupIfNeeded();

      // データ保存
      const jsonData = JSON.stringify(sessions, null, 2);
      fs.writeFileSync(SESSIONS_FILE, jsonData, 'utf-8');

      console.log('💾 セッションを保存しました');
    } catch (error) {
      console.error('❌ セッションファイルの書き込みエラー:', error);
      throw error;
    } finally {
      this.isWriting = false;
    }
  }

  // バックアップ作成
  private createBackupIfNeeded(): void {
    try {
      const today = new Date().toISOString().split('T')[0]; // YYYY-MM-DD
      const backupFile = path.join(BACKUP_DIR, `sessions_${today}.json`);

      // 今日のバックアップが既に存在する場合はスキップ
      if (fs.existsSync(backupFile)) {
        return;
      }

      // 現在のデータをバックアップ
      if (fs.existsSync(SESSIONS_FILE)) {
        fs.copyFileSync(SESSIONS_FILE, backupFile);
        console.log('💾 バックアップを作成:', backupFile);

        // 古いバックアップを削除（7日以上前）
        this.cleanOldBackups();
      }
    } catch (error) {
      console.error('⚠️ バックアップの作成エラー:', error);
      // バックアップ失敗はエラーとしない
    }
  }

  // 古いバックアップ削除
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

  // バックアップから復元
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

  // セッション取得
  async getSession(groupId: string): Promise<Session | null> {
    const sessions = this.getAllSessions();
    const session = sessions[groupId];

    if (!session) return null;

    // activeまたはsettledのセッションのみ返す
    if (session.status === 'active' || session.status === 'settled') {
      return session;
    }

    return null;
  }

  // セッション作成
  async createSession(session: Session): Promise<void> {
    const sessions = this.getAllSessions();
    sessions[session.groupId] = session;
    this.saveAllSessions(sessions);
  }

  // セッション更新
  async updateSession(groupId: string, data: Partial<Session>): Promise<void> {
    const sessions = this.getAllSessions();
    if (sessions[groupId]) {
      sessions[groupId] = {
        ...sessions[groupId],
        ...data,
        updatedAt: new Date().toISOString(),
      };
      this.saveAllSessions(sessions);
    }
  }

  // 支払い追加
  async addPayment(groupId: string, payment: any): Promise<void> {
    const sessions = this.getAllSessions();
    if (sessions[groupId]) {
      sessions[groupId].payments.push(payment);
      sessions[groupId].updatedAt = new Date().toISOString();
      this.saveAllSessions(sessions);
    }
  }

  // セッション削除(終了)
  async endSession(groupId: string): Promise<void> {
    const sessions = this.getAllSessions();
    if (sessions[groupId]) {
      sessions[groupId].status = 'completed';
      sessions[groupId].updatedAt = new Date().toISOString();
      this.saveAllSessions(sessions);
    }
  }
}

export const storageService = new StorageService();
