import * as line from '@line/bot-sdk';
import * as dotenv from 'dotenv';
import * as fs from 'fs';

dotenv.config();

const client = new line.messagingApi.MessagingApiClient({
  channelAccessToken: process.env.LINE_CHANNEL_ACCESS_TOKEN || '',
});

interface UserInfo {
  userId: string;
  displayName: string;
  statusMessage?: string;
  pictureUrl?: string;
  error?: string;
}

async function getUserInfo(userId: string): Promise<UserInfo> {
  try {
    const profile = await client.getProfile(userId);
    return {
      userId: profile.userId,
      displayName: profile.displayName,
      statusMessage: profile.statusMessage,
      pictureUrl: profile.pictureUrl,
    };
  } catch (error: any) {
    return {
      userId,
      displayName: '(取得失敗)',
      error: error.message || 'Unknown error',
    };
  }
}

async function extractUserIdsFromLog(logFilePath: string): Promise<string[]> {
  try {
    const content = fs.readFileSync(logFilePath, 'utf-8');

    // userId パターンを抽出（U + 32文字の16進数）
    const userIdPattern = /U[a-f0-9A-F]{32}/g;
    const matches = content.match(userIdPattern);

    if (!matches) {
      return [];
    }

    // 重複を除去
    const uniqueUserIds = Array.from(new Set(matches));
    return uniqueUserIds;
  } catch (error: any) {
    console.error('❌ ログファイル読み込みエラー:', error.message);
    return [];
  }
}

async function main() {
  const logFilePath = process.argv[2];

  if (!logFilePath) {
    console.error('');
    console.error('❌ ログファイルパスが指定されていません');
    console.log('');
    console.log('使い方:');
    console.log('  ts-node src/scripts/get-users-from-log.ts <LOG_FILE_PATH>');
    console.log('');
    console.log('例:');
    console.log('  ts-node src/scripts/get-users-from-log.ts /path/to/server.log');
    console.log('');
    process.exit(1);
  }

  console.log('');
  console.log('🔍 ログファイルからユーザーIDを抽出中...');
  console.log(`📄 ファイル: ${logFilePath}`);
  console.log('');

  const userIds = await extractUserIdsFromLog(logFilePath);

  if (userIds.length === 0) {
    console.log('⚠️ ユーザーIDが見つかりませんでした');
    console.log('');
    process.exit(0);
  }

  console.log(`✅ ${userIds.length}件のユニークなユーザーIDを発見`);
  console.log('');
  console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
  console.log('');

  // 各ユーザー情報を取得
  const users: UserInfo[] = [];

  for (let i = 0; i < userIds.length; i++) {
    const userId = userIds[i];
    console.log(`[${i + 1}/${userIds.length}] ${userId} を取得中...`);

    const userInfo = await getUserInfo(userId);
    users.push(userInfo);

    // API制限を考慮して少し待つ
    if (i < userIds.length - 1) {
      await new Promise(resolve => setTimeout(resolve, 500));
    }
  }

  console.log('');
  console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
  console.log('');
  console.log('👥 ユーザー一覧:');
  console.log('');

  // 結果を表形式で表示
  const successUsers = users.filter(u => !u.error);
  const failedUsers = users.filter(u => u.error);

  if (successUsers.length > 0) {
    console.log('✅ 取得成功:');
    console.log('');
    successUsers.forEach((user, index) => {
      console.log(`${index + 1}. ${user.displayName}`);
      console.log(`   ユーザーID: ${user.userId}`);
      if (user.statusMessage) {
        console.log(`   ステータス: ${user.statusMessage}`);
      }
      console.log('');
    });
  }

  if (failedUsers.length > 0) {
    console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
    console.log('');
    console.log('❌ 取得失敗:');
    console.log('');
    failedUsers.forEach((user, index) => {
      console.log(`${index + 1}. ユーザーID: ${user.userId}`);
      console.log(`   エラー: ${user.error}`);
      console.log('   理由: ブロックされたか、無効なIDです');
      console.log('');
    });
  }

  console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
  console.log('');
  console.log('📊 サマリー:');
  console.log(`   総ユーザー数: ${users.length}名`);
  console.log(`   取得成功: ${successUsers.length}名`);
  console.log(`   取得失敗: ${failedUsers.length}名`);
  console.log('');

  // JSON形式で出力（オプション）
  const outputJson = process.argv.includes('--json');
  if (outputJson) {
    const outputFile = 'users_from_log.json';
    fs.writeFileSync(outputFile, JSON.stringify(users, null, 2), 'utf-8');
    console.log(`💾 JSON出力: ${outputFile}`);
    console.log('');
  }
}

main().catch(error => {
  console.error('');
  console.error('❌ エラーが発生しました:', error);
  console.log('');
  process.exit(1);
});
