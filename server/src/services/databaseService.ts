import Database from 'better-sqlite3';
import * as fs from 'fs';
import * as path from 'path';
import { Session } from '../types';

const DATA_DIR = path.join(__dirname, '../data');
const DB_PATH = path.join(DATA_DIR, 'database.db');
const SCHEMA_PATH = path.join(__dirname, '../migrations/001_initial_schema.sql');

// データディレクトリが存在しない場合は作成
if (!fs.existsSync(DATA_DIR)) {
  fs.mkdirSync(DATA_DIR, { recursive: true });
  console.log('📁 データディレクトリを作成:', DATA_DIR);
}

export class DatabaseService {
  private db: Database.Database;
  private getSessionStmt: Database.Statement;
  private upsertSessionStmt: Database.Statement;
  private deleteSessionStmt: Database.Statement;

  constructor() {
    // データベース接続
    this.db = new Database(DB_PATH);

    // パフォーマンス最適化設定
    this.db.pragma('journal_mode = WAL');  // 並行読み込み可能
    this.db.pragma('synchronous = NORMAL'); // 速度優先（一部安全性犠牲）
    this.db.pragma('cache_size = 10000');   // キャッシュ増量（約10MB）
    this.db.pragma('temp_store = MEMORY');  // 一時データはメモリ
    this.db.pragma('busy_timeout = 10000'); // タイムアウト10秒

    console.log('🗄️ SQLiteデータベース接続完了:', DB_PATH);

    // スキーマ初期化
    this.initSchema();

    // プリペアドステートメント（高速化）
    this.getSessionStmt = this.db.prepare(
      'SELECT data FROM sessions WHERE group_id = ? AND status IN ("active", "settled") ORDER BY updated_at DESC LIMIT 1'
    );

    this.upsertSessionStmt = this.db.prepare(`
      INSERT INTO sessions (id, group_id, status, created_at, updated_at, data)
      VALUES (?, ?, ?, ?, ?, ?)
      ON CONFLICT(id) DO UPDATE SET
        status = excluded.status,
        updated_at = excluded.updated_at,
        data = excluded.data
    `);

    this.deleteSessionStmt = this.db.prepare(
      'DELETE FROM sessions WHERE id = ?'
    );
  }

  /**
   * スキーマ初期化
   */
  private initSchema(): void {
    try {
      const schema = fs.readFileSync(SCHEMA_PATH, 'utf-8');
      this.db.exec(schema);
      console.log('✅ データベーススキーマを初期化しました');
    } catch (error) {
      console.error('❌ スキーマ初期化エラー:', error);
      throw error;
    }
  }

  /**
   * セッション取得
   */
  getSession(groupId: string): Session | null {
    try {
      const row = this.getSessionStmt.get(groupId) as any;
      if (!row) return null;

      return JSON.parse(row.data) as Session;
    } catch (error) {
      console.error('❌ セッション取得エラー:', groupId, error);
      return null;
    }
  }

  /**
   * セッション保存（UPSERT）
   */
  saveSession(session: Session): void {
    try {
      this.upsertSessionStmt.run(
        session.sessionId,
        session.groupId,
        session.status,
        session.createdAt,
        new Date().toISOString(),
        JSON.stringify(session)
      );
    } catch (error) {
      console.error('❌ セッション保存エラー:', session.sessionId, error);
      throw error;
    }
  }

  /**
   * 複数セッションを一括保存（トランザクション）
   */
  batchSaveSessions(sessions: Session[]): void {
    const transaction = this.db.transaction((sessions: Session[]) => {
      for (const session of sessions) {
        this.saveSession(session);
      }
    });

    try {
      transaction(sessions);
      console.log(`💾 ${sessions.length}件のセッションを一括保存しました`);
    } catch (error) {
      console.error('❌ 一括保存エラー:', error);
      throw error;
    }
  }

  /**
   * セッション削除
   */
  deleteSession(sessionId: string): void {
    try {
      this.deleteSessionStmt.run(sessionId);
      console.log(`🗑️ セッションを削除: ${sessionId}`);
    } catch (error) {
      console.error('❌ セッション削除エラー:', sessionId, error);
      throw error;
    }
  }

  /**
   * 全セッション取得（管理用）
   */
  getAllSessions(): Session[] {
    try {
      const rows = this.db.prepare('SELECT data FROM sessions ORDER BY updated_at DESC').all() as any[];
      return rows.map(row => JSON.parse(row.data) as Session);
    } catch (error) {
      console.error('❌ 全セッション取得エラー:', error);
      return [];
    }
  }

  /**
   * データベース最適化（VACUUM）
   */
  vacuum(): void {
    try {
      console.log('🔧 データベース最適化を開始...');
      this.db.exec('VACUUM');
      console.log('✅ データベース最適化完了');
    } catch (error) {
      console.error('❌ 最適化エラー:', error);
    }
  }

  /**
   * データベース接続クローズ
   */
  close(): void {
    try {
      this.db.close();
      console.log('✅ データベース接続を閉じました');
    } catch (error) {
      console.error('❌ 接続クローズエラー:', error);
    }
  }

  /**
   * 分析イベント記録（将来の拡張用）
   */
  logAnalyticsEvent(event: {
    eventType: string;
    groupId?: string;
    userId?: string;
    sessionId?: string;
    amount?: number;
    label?: string;
    metadata?: any;
  }): void {
    try {
      const stmt = this.db.prepare(`
        INSERT INTO analytics_events (event_type, group_id, user_id, session_id, amount, label, created_at, metadata)
        VALUES (?, ?, ?, ?, ?, ?, ?, ?)
      `);

      stmt.run(
        event.eventType,
        event.groupId || null,
        event.userId || null,
        event.sessionId || null,
        event.amount || null,
        event.label || null,
        new Date().toISOString(),
        event.metadata ? JSON.stringify(event.metadata) : null
      );
    } catch (error) {
      // 分析ログのエラーはメインの処理に影響させない
      console.error('⚠️ 分析イベント記録エラー:', error);
    }
  }
}

// シングルトンインスタンス
export const databaseService = new DatabaseService();
