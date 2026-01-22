#!/usr/bin/env node
/**
 * マイグレーション検証スクリプト
 *
 * 使用方法:
 *   npm run verify-migration
 *
 * 機能:
 * - JSONファイルとSQLiteデータベースの内容を比較
 * - データの整合性を確認
 * - 不一致があれば詳細レポート出力
 */

import * as fs from 'fs';
import * as path from 'path';
import { databaseService } from '../services/databaseService';
import { Session } from '../types';

const DATA_DIR = path.join(__dirname, '../data');
const SESSIONS_FILE = path.join(DATA_DIR, 'sessions.json');

interface VerificationResult {
  success: boolean;
  totalInJSON: number;
  totalInDB: number;
  matched: number;
  missing: string[];
  mismatch: Array<{
    groupId: string;
    field: string;
    jsonValue: any;
    dbValue: any;
  }>;
}

/**
 * JSONファイルからセッションを読み込み
 */
function loadSessionsFromJSON(): { [groupId: string]: Session } | null {
  try {
    if (!fs.existsSync(SESSIONS_FILE)) {
      console.log('⚠️ sessions.jsonが見つかりません');
      return null;
    }

    const jsonData = fs.readFileSync(SESSIONS_FILE, 'utf-8');
    if (!jsonData.trim()) {
      console.log('⚠️ sessions.jsonが空です');
      return null;
    }

    return JSON.parse(jsonData);
  } catch (error) {
    console.error('❌ JSONファイルの読み込みエラー:', error);
    return null;
  }
}

/**
 * セッションの内容を比較
 */
function compareSession(
  jsonSession: Session,
  dbSession: Session
): Array<{ field: string; jsonValue: any; dbValue: any }> {
  const differences: Array<{ field: string; jsonValue: any; dbValue: any }> = [];

  // 基本フィールドの比較
  const fieldsToCheck: Array<keyof Session> = [
    'groupId',
    'status',
    'createdAt'
  ];

  for (const field of fieldsToCheck) {
    if (jsonSession[field] !== dbSession[field]) {
      differences.push({
        field,
        jsonValue: jsonSession[field],
        dbValue: dbSession[field]
      });
    }
  }

  // 配列フィールドの比較
  if (jsonSession.members.length !== dbSession.members.length) {
    differences.push({
      field: 'members.length',
      jsonValue: jsonSession.members.length,
      dbValue: dbSession.members.length
    });
  }

  if (jsonSession.payments.length !== dbSession.payments.length) {
    differences.push({
      field: 'payments.length',
      jsonValue: jsonSession.payments.length,
      dbValue: dbSession.payments.length
    });
  }

  return differences;
}

/**
 * マイグレーションを検証
 */
function verify(): VerificationResult {
  const result: VerificationResult = {
    success: false,
    totalInJSON: 0,
    totalInDB: 0,
    matched: 0,
    missing: [],
    mismatch: []
  };

  console.log('🔍 マイグレーション検証開始');
  console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');

  // JSONファイルを読み込み
  const jsonSessions = loadSessionsFromJSON();
  if (!jsonSessions) {
    console.log('⚠️ 検証対象のJSONファイルがありません');
    return result;
  }

  const jsonSessionArray = Object.values(jsonSessions) as Session[];
  result.totalInJSON = jsonSessionArray.length;

  console.log(`📦 JSONファイル内のセッション数: ${result.totalInJSON}`);

  // データベースから全セッションを取得
  const dbSessions = databaseService.getAllSessions();
  result.totalInDB = dbSessions.length;

  console.log(`🗄️ データベース内のセッション数: ${result.totalInDB}`);

  if (result.totalInJSON === 0) {
    console.log('⚠️ JSONファイルにセッションがありません');
    return result;
  }

  console.log('\n🔎 データ整合性チェック中...\n');

  // 各JSONセッションについてDBに存在するか確認
  for (const jsonSession of jsonSessionArray) {
    const dbSession = databaseService.getSession(jsonSession.groupId);

    if (!dbSession) {
      result.missing.push(jsonSession.groupId);
      console.log(`❌ 不足: ${jsonSession.groupId} - データベースに存在しません`);
      continue;
    }

    // セッション内容を比較
    const differences = compareSession(jsonSession, dbSession);

    if (differences.length > 0) {
      differences.forEach(diff => {
        result.mismatch.push({
          groupId: jsonSession.groupId,
          field: diff.field,
          jsonValue: diff.jsonValue,
          dbValue: diff.dbValue
        });
        console.log(`⚠️ 不一致: ${jsonSession.groupId}`);
        console.log(`   フィールド: ${diff.field}`);
        console.log(`   JSON: ${JSON.stringify(diff.jsonValue)}`);
        console.log(`   DB:   ${JSON.stringify(diff.dbValue)}`);
      });
    } else {
      result.matched++;
    }
  }

  console.log('\n━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
  console.log('📊 検証結果');
  console.log(`✅ 一致: ${result.matched}/${result.totalInJSON}`);
  console.log(`❌ 不足: ${result.missing.length}件`);
  console.log(`⚠️ 不一致: ${result.mismatch.length}件`);

  // 成功判定
  result.success = result.missing.length === 0 && result.mismatch.length === 0;

  if (result.success) {
    console.log('\n🎉 検証成功！全てのデータが正しく移行されています。');
  } else {
    console.log('\n⚠️ 検証失敗：データの不一致または不足があります。');

    if (result.missing.length > 0) {
      console.log('\n❌ データベースに存在しないセッション:');
      result.missing.forEach(groupId => {
        console.log(`   - ${groupId}`);
      });
    }

    if (result.mismatch.length > 0) {
      console.log('\n⚠️ データ不一致の詳細:');
      const groupedMismatch = result.mismatch.reduce((acc, item) => {
        if (!acc[item.groupId]) {
          acc[item.groupId] = [];
        }
        acc[item.groupId].push(item);
        return acc;
      }, {} as { [groupId: string]: typeof result.mismatch });

      Object.entries(groupedMismatch).forEach(([groupId, items]) => {
        console.log(`   グループID: ${groupId}`);
        items.forEach(item => {
          console.log(`     - ${item.field}: JSON=${JSON.stringify(item.jsonValue)}, DB=${JSON.stringify(item.dbValue)}`);
        });
      });
    }
  }

  return result;
}

/**
 * メイン実行
 */
function main() {
  try {
    const result = verify();

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

export { verify, compareSession };
