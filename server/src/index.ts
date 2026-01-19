import express from 'express';
import * as line from '@line/bot-sdk';
import { commandHandler } from './handlers/commandHandler';
import * as dotenv from 'dotenv';

// 環境変数読み込み
dotenv.config();

// 環境変数チェック
function validateEnv(): void {
  const required = ['LINE_CHANNEL_SECRET', 'LINE_CHANNEL_ACCESS_TOKEN'];
  const missing = required.filter(key => !process.env[key]);

  if (missing.length > 0) {
    console.error('❌ 必須の環境変数が不足しています:', missing.join(', '));
    console.error('💡 .envファイルを確認してください');
    process.exit(1);
  }

  console.log('✅ 環境変数を確認しました');
}

validateEnv();

const app = express();
const PORT = process.env.PORT || 3000;

// ★ LINE SDK クライアントの初期化 (ここが重要)
const client = new line.messagingApi.MessagingApiClient({
  channelAccessToken: process.env.LINE_CHANNEL_ACCESS_TOKEN || '',
});

// LINE Webhook設定
const lineConfig: line.MiddlewareConfig = {
  channelSecret: process.env.LINE_CHANNEL_SECRET || '',
};

// Webhook endpoint
app.post('/webhook', express.json(), express.urlencoded({ extended: true }), async (req, res) => {
  // Webhookの署名検証
  const signature = req.get('x-line-signature');
  if (!signature) {
    console.error('❌ 署名がありません');
    res.status(401).send('Unauthorized');
    return;
  }

  // リクエストボディの検証
  try {
    // LINE SDKの署名検証を使用
    const body = JSON.stringify(req.body);
    if (!line.validateSignature(body, lineConfig.channelSecret, signature)) {
      console.error('❌ 署名が無効です');
      res.status(401).send('Unauthorized');
      return;
    }
  } catch (error) {
    console.error('❌ 署名検証エラー:', error);
    res.status(400).send('Bad Request');
    return;
  }

  // イベント取得
  const events: line.WebhookEvent[] = req.body.events || [];

  // 各イベントを処理
  await Promise.all(
    events.map(async (event) => {
      try {
        console.log('📨 イベントを受信:', JSON.stringify(event, null, 2));
        if (event.type === 'message') {
          await commandHandler.handleMessage(event);
        } else if (event.type === 'join') {
          // グループに追加された時のウェルカムメッセージ
          await commandHandler.handleJoin(event);
        }
      } catch (error) {
        console.error('❌ イベント処理エラー:', error);
      }
    })
  );

  res.status(200).send('OK');
});

// ヘルスチェック用エンドポイント
app.get('/health', (req, res) => {
  res.status(200).json({ status: 'OK', timestamp: new Date().toISOString() });
});

// ルートエンドポイント
app.get('/', (req, res) => {
  res.send('清算くんLINEボット サーバー稼働中');
});

// サーバー起動
app.listen(PORT, () => {
  console.log('\n');
  console.log('========================================');
  console.log('🍻 清算くん LINEボット サーバー起動');
  console.log('========================================');
  console.log(`🚀 サーバーが起動しました ポート: ${PORT}`);
  console.log(`📍 Webhook URL: http://localhost:${PORT}/webhook`);
  console.log(`💚 ヘルスチェック: http://localhost:${PORT}/health`);
  console.log(`⏰ 開始時刻: ${new Date().toLocaleString('ja-JP')}`);
  console.log('========================================');
  console.log('\n');
  console.log('💡 Tip: ngrok経由で外部公開する場合:');
  console.log('   ngrok http 3000');
  console.log('\n');
});
