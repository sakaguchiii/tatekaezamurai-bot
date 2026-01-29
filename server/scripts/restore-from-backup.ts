/**
 * バックアップファイルからデータベースにセッションを復元するスクリプト
 *
 * 使い方:
 * npx ts-node scripts/restore-from-backup.ts 2026-01-25
 */

import * as fs from 'fs';
import * as path from 'path';
import { DatabaseService } from '../src/services/databaseService';
import { Session } from '../src/types';

const BACKUP_DIR = path.join(__dirname, '../dist/data/backups');

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
  console.log('\n💾 データベースに保存中...');
  const dbService = new DatabaseService();

  try {
    dbService.batchSaveSessions(sessions);
    console.log(`✅ ${sessions.length}件のセッションを復元しました`);

    // 確認のため取得してみる
    console.log('\n🔍 復元確認:');
    sessions.forEach(session => {
      const retrieved = dbService.getSession(session.groupId);
      if (retrieved) {
        console.log(`  ✅ ${session.groupName || session.groupId} - 復元成功`);
      } else {
        console.log(`  ❌ ${session.groupName || session.groupId} - 復元失敗`);
      }
    });
  } catch (error) {
    console.error('❌ 復元エラー:', error);
    process.exit(1);
  } finally {
    dbService.close();
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
