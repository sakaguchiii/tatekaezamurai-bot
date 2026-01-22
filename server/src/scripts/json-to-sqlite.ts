#!/usr/bin/env node
/**
 * JSON → SQLite マイグレーションスクリプト
 *
 * 使用方法:
 *   npm run migrate          # 実際にマイグレーション実行
 *   npm run migrate:dry-run  # ドライラン（実行せずに確認のみ）
 *
 * 機能:
 * - 既存のJSONファイルからセッションデータを読み込み
 * - SQLiteデータベースに移行
 * - 移行前にバックアップを作成
 * - ドライランモードでの事前確認
 */

import * as fs from 'fs';
import * as path from 'path';
import { databaseService } from '../services/databaseService';
import { Session } from '../types';

const DATA_DIR = path.join(__dirname, '../data');
const SESSIONS_FILE = path.join(DATA_DIR, 'sessions.json');
const BACKUP_DIR = path.join(DATA_DIR, 'backups');

interface MigrationResult {
  success: boolean;
  totalSessions: number;
  migratedSessions: number;
  errors: Array<{ groupId: string; error: string }>;
  skippedSessions: number;
}

/**
 * JSONファイルからセッションを読み込み
 */
function loadSessionsFromJSON(): { [groupId: string]: Session } | null {
  try {
    if (!fs.existsSync(SESSIONS_FILE)) {
      console.log('⚠️ sessions.jsonが見つかりません:', SESSIONS_FILE);
      return null;
    }

    const jsonData = fs.readFileSync(SESSIONS_FILE, 'utf-8');
    if (!jsonData.trim()) {
      console.log('⚠️ sessions.jsonが空です');
      return null;
    }

    const sessions = JSON.parse(jsonData);
    return sessions;
  } catch (error) {
    console.error('❌ JSONファイルの読み込みエラー:', error);
    return null;
  }
}

/**
 * バックアップを作成
 */
function createBackup(): boolean {
  try {
    if (!fs.existsSync(BACKUP_DIR)) {
      fs.mkdirSync(BACKUP_DIR, { recursive: true });
    }

    const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
    const backupFile = path.join(BACKUP_DIR, `sessions_before_migration_${timestamp}.json`);

    fs.copyFileSync(SESSIONS_FILE, backupFile);
    console.log('✅ バックアップを作成:', backupFile);
    return true;
  } catch (error) {
    console.error('❌ バックアップ作成エラー:', error);
    return false;
  }
}

/**
 * マイグレーションを実行
 */
function migrate(dryRun: boolean = false): MigrationResult {
  const result: MigrationResult = {
    success: false,
    totalSessions: 0,
    migratedSessions: 0,
    errors: [],
    skippedSessions: 0
  };

  console.log('🚀 マイグレーション開始');
  console.log(`📋 モード: ${dryRun ? 'ドライラン（確認のみ）' : '本番実行'}`);
  console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');

  // JSONファイルを読み込み
  const sessions = loadSessionsFromJSON();
  if (!sessions) {
    console.log('⚠️ マイグレーションするデータがありません');
    return result;
  }

  const sessionArray = Object.values(sessions) as Session[];
  result.totalSessions = sessionArray.length;

  console.log(`📦 検出されたセッション数: ${result.totalSessions}`);

  if (result.totalSessions === 0) {
    console.log('⚠️ セッションが0件です');
    return result;
  }

  // ドライランの場合は内容を表示して終了
  if (dryRun) {
    console.log('\n📊 マイグレーション対象セッション:');
    sessionArray.forEach((session, index) => {
      console.log(`  ${index + 1}. グループID: ${session.groupId}`);
      console.log(`     ステータス: ${session.status}`);
      console.log(`     作成日時: ${session.createdAt}`);
      console.log(`     支払い件数: ${session.payments.length}`);
      console.log(`     メンバー数: ${session.members.length}`);
      console.log('');
    });

    console.log('✅ ドライラン完了');
    console.log('💡 本番実行する場合は npm run migrate を実行してください');
    result.success = true;
    return result;
  }

  // 本番実行: バックアップ作成
  if (!createBackup()) {
    console.error('❌ バックアップ作成に失敗しました。マイグレーションを中止します。');
    return result;
  }

  // データベースに保存
  console.log('\n💾 SQLiteへの移行を開始...');

  try {
    // バッチ保存でトランザクション処理
    databaseService.batchSaveSessions(sessionArray);
    result.migratedSessions = sessionArray.length;
    result.success = true;

    console.log(`✅ ${result.migratedSessions}件のセッションを移行しました`);
  } catch (error) {
    console.error('❌ マイグレーションエラー:', error);
    result.errors.push({
      groupId: 'batch',
      error: error instanceof Error ? error.message : String(error)
    });
    return result;
  }

  console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
  console.log('🎉 マイグレーション完了！');
  console.log(`📊 結果: ${result.migratedSessions}/${result.totalSessions} セッションを移行`);

  if (result.errors.length > 0) {
    console.log(`⚠️ エラー: ${result.errors.length}件`);
    result.errors.forEach(err => {
      console.log(`   - ${err.groupId}: ${err.error}`);
    });
  }

  return result;
}

/**
 * メイン実行
 */
function main() {
  const args = process.argv.slice(2);
  const dryRun = args.includes('--dry-run') || args.includes('-d');

  try {
    const result = migrate(dryRun);

    // 終了コード
    if (result.success) {
      process.exit(0);
    } else {
      process.exit(1);
    }
  } catch (error) {
    console.error('❌ 予期しないエラー:', error);
    process.exit(1);
  }
}

// スクリプトとして実行された場合のみ実行
if (require.main === module) {
  main();
}

export { migrate, loadSessionsFromJSON, createBackup };
