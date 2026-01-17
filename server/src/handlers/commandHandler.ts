import * as line from '@line/bot-sdk';
import { storageService } from '../services/storageService';
import { CommandParser } from '../utils/parser';
import { Calculator } from '../utils/calculator';
import { MessageFormatter } from '../utils/formatter';
import { Session } from '../types';

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

    // グループメンバー取得
    const memberCount = 10; // グループ人数は取得できないため固定値を使用

    // メンバープロフィール取得は制限があるため、最初のユーザーのみ
    const userProfile = await client.getGroupMemberProfile(groupId, userId);

    // 簡易的にメンバーリストを作成(実際は参加時に追加)
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
    const message = `🍻 たてかえ侍を開始します！

【参加メンバー】
グループメンバー全員が対象です
(グループ人数: 約${memberCount}名)

支払いを記録するには:
「一軒目 14000円」のように入力してください

💡 使い方を見る → 「ヘルプ」`;

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

    // ユーザーがメンバーリストにいない場合は追加
    if (!session.members.find(m => m.userId === userId)) {
      session.members.push({
        userId: userProfile.userId,
        displayName: userProfile.displayName,
        pictureUrl: userProfile.pictureUrl || '',
        joinedAt: new Date().toISOString(),
        participationRange: {
          startFrom: 0,
          endAt: null,
        },
      });
      await storageService.updateSession(groupId, { members: session.members });
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
}

export const commandHandler = new CommandHandler();
