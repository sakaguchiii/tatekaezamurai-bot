import * as line from '@line/bot-sdk';
import { storageService } from '../services/storageService';
import { CommandParser } from '../utils/parser';
import { Calculator } from '../utils/calculator';
import { MessageFormatter } from '../utils/formatter';
import { Session } from '../types';
import * as dotenv from 'dotenv';

// 環境変数を確実に読み込む
dotenv.config();

const client = new line.messagingApi.MessagingApiClient({
  channelAccessToken: process.env.LINE_CHANNEL_ACCESS_TOKEN || '',
});

export class CommandHandler {
  // メインハンドラー
  async handleMessage(event: line.WebhookEvent): Promise<void> {
    if (event.type !== 'message' || event.message.type !== 'text') return;

    const text = event.message.text;
    const source = event.source;
    const replyToken = event.replyToken;

    // グループチャット以外は無視
    if (source.type !== 'group') {
      if (replyToken) {
        await client.replyMessage({
          replyToken,
          messages: [{
            type: 'text',
            text: 'このボットはグループチャット専用です',
          }],
        });
      }
      return;
    }

    const groupId = source.groupId!;
    const userId = source.userId!;

    // コマンド判定
    try {
      if (CommandParser.isStartCommand(text)) {
        await this.handleStart(replyToken, groupId, userId);
      } else if (CommandParser.isJoinMemberCommand(text)) {
        await this.handleJoinMember(replyToken, groupId, userId);
      } else if (CommandParser.isSettleCommand(text)) {
        await this.handleSettle(replyToken, groupId);
      } else if (CommandParser.isStatusCommand(text)) {
        await this.handleStatus(replyToken, groupId);
      } else if (CommandParser.isCancelCommand(text)) {
        await this.handleCancel(replyToken, groupId);
      } else if (CommandParser.isHelpCommand(text)) {
        await this.handleHelp(replyToken);
      } else if (CommandParser.isEndCommand(text)) {
        await this.handleEnd(replyToken, groupId);
      } else {
        const paymentData = CommandParser.parsePaymentCommand(text);
        if (paymentData) {
          await this.handlePayment(replyToken, groupId, userId, paymentData);
        }
      }
    } catch (error) {
      console.error('Error handling command:', error);
      if (replyToken) {
        await client.replyMessage({
          replyToken,
          messages: [{
            type: 'text',
            text: 'エラーが発生しました。もう一度お試しください。',
          }],
        });
      }
    }
  }

  // 「開始」コマンド処理
  private async handleStart(replyToken: string, groupId: string, userId: string): Promise<void> {
    // 既存セッション確認
    const existingSession = await storageService.getSession(groupId);
    if (existingSession && existingSession.status === 'active') {
      await client.replyMessage({
        replyToken,
        messages: [{
          type: 'text',
          text: '既にセッションが開始されています。\n「状況」で確認するか、「終了」してから新規開始してください',
        }],
      });
      return;
    }

    // メンバープロフィール取得
    const userProfile = await client.getGroupMemberProfile(groupId, userId);

    // 最初のメンバーとしてセッション作成者を登録
    // 他のメンバーは支払い記録時に自動追加される
    const members = [{
      userId: userProfile.userId,
      displayName: userProfile.displayName,
      pictureUrl: userProfile.pictureUrl || '',
      joinedAt: new Date().toISOString(),
      participationRange: {
        startFrom: 0,
        endAt: null,
      },
    }];

    // セッション作成
    const session: Session = {
      groupId,
      groupName: '',
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
      createdBy: {
        userId: userProfile.userId,
        displayName: userProfile.displayName,
      },
      status: 'active',
      members,
      payments: [],
      settlements: [],
      reminder: {
        enabled: true,
        count: 0,
      },
    };

    await storageService.createSession(session);

    // 返信メッセージ
    const message = `🍻 清算くんを開始します！

【重要】まず参加者全員が「参加」と入力してください！

現在の参加者: ${session.members.length}名
・${userProfile.displayName}さん（セッション作成者）

【記録方法】
一軒目 14000円
ラーメン 500円
タクシー 3000

のように入力してください
(ラベル + スペース + 金額)

💡 「ヘルプ」または「?」で詳しい使い方を表示`;

    await client.replyMessage({
      replyToken,
      messages: [{ type: 'text', text: message }],
    });
  }

  // 支払い記録処理
  private async handlePayment(
    replyToken: string,
    groupId: string,
    userId: string,
    paymentData: { label: string; amount: number }
  ): Promise<void> {
    const session = await storageService.getSession(groupId);
    if (!session || session.status !== 'active') {
      await client.replyMessage({
        replyToken,
        messages: [{
          type: 'text',
          text: 'まず「開始」と入力してセッションを開始してください',
        }],
      });
      return;
    }

    // ユーザープロフィール取得
    const userProfile = await client.getGroupMemberProfile(groupId, userId);

    // ユーザーがメンバーリストにいるかチェック
    if (!session.members.find(m => m.userId === userId)) {
      await client.replyMessage({
        replyToken,
        messages: [{
          type: 'text',
          text: `${userProfile.displayName}さんはまだ参加登録されていません。\nまず「参加」と入力してください！`,
        }],
      });
      return;
    }

    // 支払い記録作成
    const payment = {
      id: `payment_${Date.now()}`,
      sequence: session.payments.length,
      label: paymentData.label,
      amount: paymentData.amount,
      paidBy: {
        userId: userProfile.userId,
        displayName: userProfile.displayName,
      },
      participants: session.members.map((m) => m.userId),
      timestamp: new Date().toISOString(),
      isDeleted: false,
    };

    await storageService.addPayment(groupId, payment);

    // 返信メッセージ
    const perPerson = Math.floor(paymentData.amount / session.members.length);
    const totalAmount = session.payments
      .filter((p) => !p.isDeleted)
      .reduce((sum, p) => sum + p.amount, 0) + paymentData.amount;

    const message = MessageFormatter.formatPaymentMessage(
      paymentData.label,
      paymentData.amount,
      userProfile.displayName,
      session.members.length,
      perPerson,
      totalAmount
    );

    await client.replyMessage({
      replyToken,
      messages: [{ type: 'text', text: message }],
    });
  }

  // 清算処理
  private async handleSettle(replyToken: string, groupId: string): Promise<void> {
    const session = await storageService.getSession(groupId);
    if (!session) {
      await client.replyMessage({
        replyToken,
        messages: [{
          type: 'text',
          text: 'まず「開始」と入力してセッションを開始してください',
        }],
      });
      return;
    }

    if (session.payments.length === 0) {
      await client.replyMessage({
        replyToken,
        messages: [{
          type: 'text',
          text: '支払い記録がありません。\n「一軒目 14000円」のように支払いを記録してください',
        }],
      });
      return;
    }

    // 収支計算
    const balances = Calculator.calculateBalances(session.payments, session.members);
    const settlements = Calculator.calculateSettlements(balances);

    // セッション更新
    await storageService.updateSession(groupId, {
      settlements,
      status: 'settled',
    });

    // 返信メッセージ
    const message = MessageFormatter.formatSettlementMessage(session, balances, settlements);

    await client.replyMessage({
      replyToken,
      messages: [{ type: 'text', text: message }],
    });
  }

  // 状況確認処理
  private async handleStatus(replyToken: string, groupId: string): Promise<void> {
    const session = await storageService.getSession(groupId);
    if (!session) {
      await client.replyMessage({
        replyToken,
        messages: [{
          type: 'text',
          text: 'セッションが開始されていません。「開始」と入力してください',
        }],
      });
      return;
    }

    const message = MessageFormatter.formatStatusMessage(session);

    await client.replyMessage({
      replyToken,
      messages: [{ type: 'text', text: message }],
    });
  }

  // キャンセル処理
  private async handleCancel(replyToken: string, groupId: string): Promise<void> {
    const session = await storageService.getSession(groupId);
    if (!session || session.payments.length === 0) {
      await client.replyMessage({
        replyToken,
        messages: [{
          type: 'text',
          text: 'キャンセルする支払い記録がありません',
        }],
      });
      return;
    }

    // 最後の支払いを削除(論理削除)
    const lastPayment = session.payments[session.payments.length - 1];
    lastPayment.isDeleted = true;

    await storageService.updateSession(groupId, {
      payments: session.payments,
    });

    await client.replyMessage({
      replyToken,
      messages: [{
        type: 'text',
        text: `✅ ${lastPayment.label}の記録をキャンセルしました`,
      }],
    });
  }

  // 終了処理
  private async handleEnd(replyToken: string, groupId: string): Promise<void> {
    const session = await storageService.getSession(groupId);
    if (!session) {
      await client.replyMessage({
        replyToken,
        messages: [{
          type: 'text',
          text: 'セッションが開始されていません',
        }],
      });
      return;
    }

    await storageService.endSession(groupId);

    await client.replyMessage({
      replyToken,
      messages: [{
        type: 'text',
        text: '✅ セッションを終了しました。\nお疲れ様でした！',
      }],
    });
  }

  // ヘルプ表示
  private async handleHelp(replyToken: string): Promise<void> {
    const message = MessageFormatter.formatHelpMessage();

    await client.replyMessage({
      replyToken,
      messages: [{ type: 'text', text: message }],
    });
  }

  // 「参加」コマンド処理
  private async handleJoinMember(replyToken: string, groupId: string, userId: string): Promise<void> {
    const session = await storageService.getSession(groupId);
    if (!session || session.status !== 'active') {
      await client.replyMessage({
        replyToken,
        messages: [{
          type: 'text',
          text: 'まず「開始」と入力してセッションを開始してください',
        }],
      });
      return;
    }

    // ユーザープロフィール取得
    const userProfile = await client.getGroupMemberProfile(groupId, userId);

    // 既にメンバーリストにいるかチェック
    if (session.members.find(m => m.userId === userId)) {
      await client.replyMessage({
        replyToken,
        messages: [{
          type: 'text',
          text: `${userProfile.displayName}さんは既に参加済みです！\n\n現在の参加者: ${session.members.length}名`,
        }],
      });
      return;
    }

    // メンバーに追加
    session.members.push({
      userId: userProfile.userId,
      displayName: userProfile.displayName,
      pictureUrl: userProfile.pictureUrl || '',
      joinedAt: new Date().toISOString(),
      participationRange: {
        startFrom: session.payments.length,
        endAt: null,
      },
    });

    await storageService.updateSession(groupId, { members: session.members });

    // 返信メッセージ
    const memberList = session.members.map(m => `・${m.displayName}さん`).join('\n');
    const message = `✅ ${userProfile.displayName}さんが参加しました！

【現在の参加者: ${session.members.length}名】
${memberList}

💡 支払いを記録するには:
「一軒目 14000円」のように入力してください`;

    await client.replyMessage({
      replyToken,
      messages: [{ type: 'text', text: message }],
    });
  }

  // グループ参加時のウェルカムメッセージ
  async handleJoin(event: line.WebhookEvent): Promise<void> {
    if (event.type !== 'join') return;

    const replyToken = event.replyToken;

    const welcomeMessage = `私はグループチャット専用の精算くんです⚡️

※個人では使えません！

🔥使い方

1️⃣「開始」でセッション開始
2️⃣ 参加者全員が「参加」と入力（重要！）
3️⃣ 支払いを記録（例: 一軒目 14000円）
4️⃣「清算」で精算結果を表示

【基本コマンド】
☑︎ 開始 / はじめ - セッション開始
☑︎ 参加 / さんか - 参加登録
☑︎ 状況 / 確認 - 途中経過
☑︎ 清算 / せいさん - 精算
☑︎ ヘルプ / ? - 詳しい使い方

⚠️ 注意
・支払い記録する前に必ず「参加」してください
・ラベル + スペース + 金額（例: ラーメン 500円）
・半角・全角スペースどちらもOK`;

    await client.replyMessage({
      replyToken,
      messages: [{ type: 'text', text: welcomeMessage }],
    });

    console.log('✅ Welcome message sent to group');
  }
}

export const commandHandler = new CommandHandler();
