import Database from 'better-sqlite3';
import * as fs from 'fs';
import * as path from 'path';
import { Session } from '../types';

const DATA_DIR = path.join(__dirname, '../data');
const DB_PATH = path.join(DATA_DIR, 'database.db');
const MIGRATIONS_DIR = path.join(__dirname, '../migrations');

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
      'SELECT data FROM sessions WHERE group_id = ? AND status IN (\'active\', \'settled\') ORDER BY updated_at DESC LIMIT 1'
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
   * スキーマ初期化（全マイグレーションを実行）
   */
  private initSchema(): void {
    try {
      // マイグレーションディレクトリ内の全SQLファイルを取得
      const migrationFiles = fs.readdirSync(MIGRATIONS_DIR)
        .filter(file => file.endsWith('.sql'))
        .sort(); // ファイル名順にソート（001_, 002_, ...）

      if (migrationFiles.length === 0) {
        console.warn('⚠️ マイグレーションファイルが見つかりません');
        return;
      }

      // 各マイグレーションを順番に実行
      for (const file of migrationFiles) {
        const filePath = path.join(MIGRATIONS_DIR, file);
        const schema = fs.readFileSync(filePath, 'utf-8');
        this.db.exec(schema);
        console.log(`✅ マイグレーション実行: ${file}`);
      }

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
        session.groupId, // IDとしてgroupIdを使用
        session.groupId,
        session.status,
        session.createdAt,
        new Date().toISOString(),
        JSON.stringify(session)
      );
    } catch (error) {
      console.error('❌ セッション保存エラー:', session.groupId, error);
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
   * WALチェックポイント実行
   * WALファイルの内容を本体DBファイルにマージ
   */
  checkpoint(): void {
    try {
      this.db.pragma('wal_checkpoint(TRUNCATE)');
    } catch (error) {
      console.error('❌ WALチェックポイントエラー:', error);
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

  /**
   * データベースインスタンスを取得（他のサービスから使用）
   */
  getDatabase(): Database.Database {
    return this.db;
  }

  /**
   * ユーザーが参加したセッション一覧を取得
   */
  getUserSessions(userId: string, options?: { limit?: number; months?: number }): Session[] {
    try {
      // 入力検証
      if (!userId || typeof userId !== 'string') {
        console.error('❌ 無効なuserId:', userId);
        return [];
      }

      // limit検証（1-100の範囲）
      const limit = options?.limit !== undefined ? options.limit : 10;
      if (limit < 1 || limit > 100 || !Number.isInteger(limit)) {
        console.error('❌ 無効なlimit:', limit);
        return [];
      }

      // months検証（1-12の範囲）
      const months = options?.months;
      if (months !== undefined) {
        if (months < 1 || months > 12 || !Number.isInteger(months)) {
          console.error('❌ 無効なmonths:', months);
          return [];
        }
      }

      // JSON検索を正確に行うため、json_each()を使用
      // members配列を展開し、userId完全一致で検索
      let sql = `
        SELECT DISTINCT s.data
        FROM sessions s, json_each(s.data, '$.members') AS member
        WHERE s.status = 'completed'
        AND json_extract(member.value, '$.userId') = ?
      `;

      // 期間フィルター（日本時間対応: UTC+9）
      if (months !== undefined) {
        sql += ` AND s.created_at >= datetime('now', '-${months} months', '+9 hours')`;
      }

      sql += ` ORDER BY s.created_at DESC LIMIT ?`;

      const stmt = this.db.prepare(sql);
      const rows = stmt.all(userId, limit) as any[];

      return rows.map(row => JSON.parse(row.data) as Session);
    } catch (error) {
      console.error('❌ ユーザーセッション取得エラー:', userId, error);
      return [];
    }
  }

  /**
   * ユーザーの統計情報を取得
   */
  getUserStats(userId: string): {
    totalSessions: number;
    totalAmount: number;
    thisMonthSessions: number;
    thisMonthAmount: number;
  } {
    try {
      // 入力検証
      if (!userId || typeof userId !== 'string') {
        console.error('❌ 無効なuserId:', userId);
        return {
          totalSessions: 0,
          totalAmount: 0,
          thisMonthSessions: 0,
          thisMonthAmount: 0,
        };
      }

      // 全期間の統計（正確なJSON検索）
      const allSessionsStmt = this.db.prepare(`
        SELECT DISTINCT s.data
        FROM sessions s, json_each(s.data, '$.members') AS member
        WHERE s.status = 'completed'
        AND json_extract(member.value, '$.userId') = ?
      `);
      const allSessions = allSessionsStmt.all(userId) as any[];

      // 今月の統計（日本時間対応: UTC+9）
      const thisMonthStmt = this.db.prepare(`
        SELECT DISTINCT s.data
        FROM sessions s, json_each(s.data, '$.members') AS member
        WHERE s.status = 'completed'
        AND json_extract(member.value, '$.userId') = ?
        AND s.created_at >= datetime('now', 'start of month', '+9 hours')
      `);
      const thisMonthSessions = thisMonthStmt.all(userId) as any[];

      // 支払額を計算（最適化: 一度だけJSONパース）
      const calculateUserAmount = (sessions: any[]): number => {
        let total = 0;
        for (const row of sessions) {
          try {
            const session = JSON.parse(row.data) as Session;
            for (const payment of session.payments) {
              if (!payment.isDeleted && payment.paidBy.userId === userId) {
                total += payment.amount;
              }
            }
          } catch (parseError) {
            console.error('❌ JSON解析エラー:', parseError);
            // スキップして続行
          }
        }
        return total;
      };

      return {
        totalSessions: allSessions.length,
        totalAmount: calculateUserAmount(allSessions),
        thisMonthSessions: thisMonthSessions.length,
        thisMonthAmount: calculateUserAmount(thisMonthSessions),
      };
    } catch (error) {
      console.error('❌ ユーザー統計取得エラー:', userId, error);
      return {
        totalSessions: 0,
        totalAmount: 0,
        thisMonthSessions: 0,
        thisMonthAmount: 0,
      };
    }
  }
}

// シングルトンインスタンス
export const databaseService = new DatabaseService();
