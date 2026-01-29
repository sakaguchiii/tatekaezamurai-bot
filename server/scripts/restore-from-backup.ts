/**
 * バックアップファイルからデータベースにセッションを復元するスクリプト
 *
 * 使い方:
 * npx ts-node scripts/restore-from-backup.ts 2026-01-25
 */

import * as fs from 'fs';
import * as path from 'path';
import Database from 'better-sqlite3';
import { Session } from '../src/types';

// プロジェクトルートから絶対パスで指定
const PROJECT_ROOT = path.join(__dirname, '..');
const BACKUP_DIR = path.join(PROJECT_ROOT, 'dist/data/backups');
const DB_PATH = path.join(PROJECT_ROOT, 'dist/data/database.db');

function restoreFromBackup(date: string) {
  const backupFile = path.join(BACKUP_DIR, `sessions_${date}.json`);

  // バックアップファイルの存在確認
  if (!fs.existsSync(backupFile)) {
    console.error(`❌ バックアップファイルが見つかりません: ${backupFile}`);
    console.log('\n利用可能なバックアップファイル:');
    const files = fs.readdirSync(BACKUP_DIR);
    files.forEach(file => console.log(`  - ${file}`));
    process.exit(1);
  }

  // バックアップファイルを読み込み
  console.log(`📂 バックアップファイルを読み込み: ${backupFile}`);
  const data = fs.readFileSync(backupFile, 'utf-8');
  const sessionsObj = JSON.parse(data) as { [groupId: string]: Session };

  // セッション配列に変換
  const sessions = Object.values(sessionsObj);
  console.log(`📊 復元対象: ${sessions.length}件のセッション`);

  // 各セッションの情報を表示
  sessions.forEach((session, index) => {
    console.log(`\n${index + 1}. グループ: ${session.groupName || session.groupId}`);
    console.log(`   作成日時: ${session.createdAt}`);
    console.log(`   ステータス: ${session.status}`);
    console.log(`   参加者: ${session.members.length}名`);
    console.log(`   支払い: ${session.payments.length}件`);
  });

  // データベースに保存
  console.log(`\n💾 データベースに保存中: ${DB_PATH}`);

  if (!fs.existsSync(DB_PATH)) {
    console.error(`❌ データベースファイルが見つかりません: ${DB_PATH}`);
    console.error('先に npm run build を実行してください');
    process.exit(1);
  }

  const db = new Database(DB_PATH);

  try {
    // プリペアドステートメント
    const upsertStmt = db.prepare(`
      INSERT INTO sessions (id, group_id, status, created_at, updated_at, data)
      VALUES (?, ?, ?, ?, ?, ?)
      ON CONFLICT(id) DO UPDATE SET
        status = excluded.status,
        updated_at = excluded.updated_at,
        data = excluded.data
    `);

    // トランザクションで一括保存
    const insertMany = db.transaction((sessions: Session[]) => {
      for (const session of sessions) {
        upsertStmt.run(
          session.groupId,
          session.groupId,
          session.status,
          session.createdAt,
          new Date().toISOString(),
          JSON.stringify(session)
        );
      }
    });

    insertMany(sessions);
    console.log(`✅ ${sessions.length}件のセッションを復元しました`);

    // 確認のため直接SQLで取得してみる（completedステータスも含む）
    console.log('\n🔍 復元確認:');
    sessions.forEach(session => {
      const row = db.prepare('SELECT id FROM sessions WHERE id = ?').get(session.groupId);
      if (row) {
        console.log(`  ✅ ${session.groupName || session.groupId} - 復元成功`);
      } else {
        console.log(`  ❌ ${session.groupName || session.groupId} - 復元失敗`);
      }
    });
  } catch (error) {
    console.error('❌ 復元エラー:', error);
    process.exit(1);
  } finally {
    db.close();
  }

  console.log('\n✨ 復元完了！');
}

// コマンドライン引数から日付を取得
const date = process.argv[2];
if (!date) {
  console.error('使い方: npx ts-node scripts/restore-from-backup.ts <日付>');
  console.error('例: npx ts-node scripts/restore-from-backup.ts 2026-01-25');
  process.exit(1);
}

restoreFromBackup(date);
