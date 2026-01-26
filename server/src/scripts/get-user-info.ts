import * as line from '@line/bot-sdk';
import * as dotenv from 'dotenv';

dotenv.config();

const client = new line.messagingApi.MessagingApiClient({
  channelAccessToken: process.env.LINE_CHANNEL_ACCESS_TOKEN || '',
});

async function getUserInfo(userId: string) {
  try {
    const profile = await client.getProfile(userId);
    console.log('');
    console.log('👤 ユーザー情報:');
    console.log('━━━━━━━━━━━━━━━━━━━━━━━');
    console.log(`  ユーザーID: ${userId}`);
    console.log(`  表示名: ${profile.displayName}`);
    console.log(`  ステータスメッセージ: ${profile.statusMessage || '(なし)'}`);
    console.log(`  プロフィール画像: ${profile.pictureUrl || '(なし)'}`);
    console.log('━━━━━━━━━━━━━━━━━━━━━━━');
    console.log('');
  } catch (error: any) {
    console.error('');
    console.error('❌ エラー:', error.message || error);
    console.log('');
    console.log('⚠️ 考えられる原因:');
    console.log('  1. ユーザーがBotをブロックした');
    console.log('  2. 無効なユーザーIDが指定された');
    console.log('  3. LINE APIのアクセストークンが無効');
    console.log('');
  }
}

const userId = process.argv[2];
if (!userId) {
  console.error('');
  console.error('❌ ユーザーIDが指定されていません');
  console.log('');
  console.log('使い方:');
  console.log('  ts-node src/scripts/get-user-info.ts <USER_ID>');
  console.log('');
  console.log('例:');
  console.log('  ts-node src/scripts/get-user-info.ts Uaac31b026cf02ebf607ed2f372884e4c');
  console.log('');
  process.exit(1);
}

getUserInfo(userId);
