import * as functions from 'firebase-functions';
import * as admin from 'firebase-admin';
import * as line from '@line/bot-sdk';
import { commandHandler } from './handlers/commandHandler';

// 環境変数読み込み（開発環境のみ）
if (process.env.NODE_ENV !== 'production') {
  require('dotenv').config();
}

// Firebase Admin初期化
admin.initializeApp();

// LINE Webhook設定
const lineConfig: line.MiddlewareConfig = {
  channelSecret: process.env.LINE_CHANNEL_SECRET || '',
};

// LINE Webhook
export const lineWebhook = functions
  .region('asia-northeast1')
  .runWith({
    secrets: [],
  })
  .https.onRequest(async (req, res) => {
    // Webhookの署名検証
    const signature = req.get('x-line-signature');
    if (!signature) {
      console.error('No signature');
      res.status(401).send('Unauthorized');
      return;
    }

    // リクエストボディの検証
    try {
      // LINE SDKの署名検証を使用
      const body = JSON.stringify(req.body);
      if (!line.validateSignature(body, lineConfig.channelSecret, signature)) {
        console.error('Invalid signature');
        res.status(401).send('Unauthorized');
        return;
      }
    } catch (error) {
      console.error('Signature validation error:', error);
      res.status(400).send('Bad Request');
      return;
    }

    // イベント取得
    const events: line.WebhookEvent[] = req.body.events || [];

    // 各イベントを処理
    await Promise.all(
      events.map(async (event) => {
        try {
          console.log('Event received:', JSON.stringify(event, null, 2));
          if (event.type === 'message') {
            await commandHandler.handleMessage(event);
          }
        } catch (error) {
          console.error('Error handling event:', error);
        }
      })
    );

    res.status(200).send('OK');
  });

// リマインダー送信(スケジュール実行) - 将来実装
export const sendReminders = functions
  .region('asia-northeast1')
  .pubsub.schedule('0 10 * * *') // 毎日10時
  .timeZone('Asia/Tokyo')
  .onRun(async (context) => {
    console.log('Reminder function executed');
    // TODO: 3日前に精算されたセッションを取得してリマインド送信
    return null;
  });
