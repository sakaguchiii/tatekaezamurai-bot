#!/usr/bin/env node
/**
 * SQLite → JSON エクスポートスクリプト
 *
 * 使用方法:
 *   npm run export-json              # 全セッションをエクスポート
 *   npm run export-json -- --active  # アクティブセッションのみエクスポート
 *
 * 機能:
 * - SQLiteデータベースからセッションを読み込み
 * - JSON形式でエクスポート
 * - バックアップやデータ移行に使用
 */

import * as fs from 'fs';
import * as path from 'path';
import { databaseService } from '../services/databaseService';
import { Session } from '../types';

const DATA_DIR = path.join(__dirname, '../data');
const BACKUP_DIR = path.join(DATA_DIR, 'backups');

interface ExportOptions {
  activeOnly?: boolean;
  outputFile?: string;
}

interface ExportResult {
  success: boolean;
  totalSessions: number;
  exportedSessions: number;
  outputFile: string;
  errors: string[];
}

/**
 * セッションをJSONにエクスポート
 */
function exportToJSON(options: ExportOptions = {}): ExportResult {
  const result: ExportResult = {
    success: false,
    totalSessions: 0,
    exportedSessions: 0,
    outputFile: '',
    errors: []
  };

  console.log('📤 SQLite → JSON エクスポート開始');
  console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');

  try {
    // データベースから全セッションを取得
    const allSessions = databaseService.getAllSessions();
    result.totalSessions = allSessions.length;

    console.log(`🗄️ データベース内のセッション数: ${result.totalSessions}`);

    if (result.totalSessions === 0) {
      console.log('⚠️ エクスポートするセッションがありません');
      return result;
    }

    // フィルタリング
    let sessionsToExport = allSessions;
    if (options.activeOnly) {
      sessionsToExport = allSessions.filter(s => s.status === 'active');
      console.log(`🔍 フィルター: アクティブセッションのみ (${sessionsToExport.length}件)`);
    }

    result.exportedSessions = sessionsToExport.length;

    if (result.exportedSessions === 0) {
      console.log('⚠️ エクスポート対象のセッションが0件です');
      result.success = true; // エラーではない
      return result;
    }

    // JSON形式に変換（sessions.jsonと同じ形式）
    const sessionsObj: { [groupId: string]: Session } = {};
    sessionsToExport.forEach(session => {
      sessionsObj[session.groupId] = session;
    });

    // 出力ファイル名を決定
    if (!options.outputFile) {
      const timestamp = new Date().toISOString().split('T')[0];
      const suffix = options.activeOnly ? 'active' : 'all';
      options.outputFile = path.join(BACKUP_DIR, `sessions_export_${suffix}_${timestamp}.json`);
    }

    // バックアップディレクトリが存在しない場合は作成
    const outputDir = path.dirname(options.outputFile);
    if (!fs.existsSync(outputDir)) {
      fs.mkdirSync(outputDir, { recursive: true });
      console.log('📁 出力ディレクトリを作成:', outputDir);
    }

    // JSONファイルに書き込み
    fs.writeFileSync(options.outputFile, JSON.stringify(sessionsObj, null, 2), 'utf-8');

    result.outputFile = options.outputFile;
    result.success = true;

    console.log(`✅ ${result.exportedSessions}件のセッションをエクスポート`);
    console.log(`📄 出力ファイル: ${result.outputFile}`);

    // ファイルサイズを表示
    const stats = fs.statSync(result.outputFile);
    const sizeKB = (stats.size / 1024).toFixed(2);
    console.log(`📊 ファイルサイズ: ${sizeKB} KB`);

    console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
    console.log('🎉 エクスポート完了！');

  } catch (error) {
    console.error('❌ エクスポートエラー:', error);
    result.errors.push(error instanceof Error ? error.message : String(error));
  }

  return result;
}

/**
 * 統計情報を表示
 */
function showStatistics(): void {
  console.log('\n📊 データベース統計情報');
  console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');

  try {
    const allSessions = databaseService.getAllSessions();

    // ステータス別カウント
    const statusCounts = allSessions.reduce((acc, session) => {
      acc[session.status] = (acc[session.status] || 0) + 1;
      return acc;
    }, {} as { [status: string]: number });

    console.log('📈 セッション数（ステータス別）:');
    Object.entries(statusCounts).forEach(([status, count]) => {
      console.log(`   ${status}: ${count}件`);
    });

    // 支払い情報の統計
    const totalPayments = allSessions.reduce(
      (sum, session) => sum + session.payments.length,
      0
    );
    const totalAmount = allSessions.reduce((sum, session) => {
      return sum + session.payments.reduce((s, p) => s + p.amount, 0);
    }, 0);

    console.log('\n💰 支払い統計:');
    console.log(`   総支払い件数: ${totalPayments}件`);
    console.log(`   総支払い金額: ${totalAmount.toLocaleString()}円`);

    // メンバー統計
    const totalMembers = allSessions.reduce(
      (sum, session) => sum + session.members.length,
      0
    );
    const avgMembers = totalMembers / allSessions.length;

    console.log('\n👥 メンバー統計:');
    console.log(`   総メンバー数: ${totalMembers}名`);
    console.log(`   平均メンバー数: ${avgMembers.toFixed(1)}名/セッション`);

  } catch (error) {
    console.error('❌ 統計情報の取得エラー:', error);
  }
}

/**
 * メイン実行
 */
function main() {
  const args = process.argv.slice(2);
  const options: ExportOptions = {
    activeOnly: args.includes('--active') || args.includes('-a')
  };

  // カスタム出力ファイル指定
  const outputIndex = args.findIndex(arg => arg === '--output' || arg === '-o');
  if (outputIndex !== -1 && args[outputIndex + 1]) {
    options.outputFile = args[outputIndex + 1];
  }

  // 統計情報表示オプション
  const showStats = args.includes('--stats') || args.includes('-s');

  try {
    if (showStats) {
      showStatistics();
    } else {
      const result = exportToJSON(options);

      // 終了コード
      if (result.success) {
        process.exit(0);
      } else {
        process.exit(1);
      }
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

export { exportToJSON, showStatistics };
