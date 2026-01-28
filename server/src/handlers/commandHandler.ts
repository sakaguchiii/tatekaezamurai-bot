import * as line from '@line/bot-sdk';
import { storageService } from '../services/storageService';
import { friendService } from '../services/friendService';
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
            text: '⚠️ グループ専用です',
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
      console.error('❌ コマンド処理エラー:', error);
      if (replyToken) {
        await client.replyMessage({
          replyToken,
          messages: [{
            type: 'text',
            text: '⚠️ エラーが発生しました',
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
          text: '⚠️ 既に開始済みです\n\n「状況」で確認 / 「終了」で再開始',
        }],
      });
      return;
    }

    // グループ名を取得
    let groupName = '';
    try {
      const groupSummary = await client.getGroupSummary(groupId);
      groupName = groupSummary.groupName;
      console.log(`📝 グループ名取得成功: ${groupName}`);
    } catch (error) {
      console.warn('⚠️ グループ名取得失敗:', error);
      groupName = '';  // フォールバック: 空文字
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
      groupName,
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

    // 返信メッセージ（3つに分割）
    await client.replyMessage({
      replyToken,
      messages: [
        {
          type: 'text',
          text: `清算くん開始！\n⚡️現在の参加者：${session.members.length}名\n・${userProfile.displayName}さん`
        },
        {
          type: 'text',
          text: `⚠️ 参加する人は「参加」と入力！`
        },
        {
          type: 'text',
          text: `💡 記録の入力方法\n【項目名 ｽﾍﾟｰｽ 金額】\n例：一軒目　5000円\n例：ラーメン　2000`
        }
      ],
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
          text: '⚠️ まず「開始」してください',
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
          text: `⚠️ まず「参加」してください`,
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

    // 返信メッセージ（簡潔に）
    const message = `✅ ${paymentData.label} ${paymentData.amount.toLocaleString()}円 記録！`;

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
          text: '⚠️ まず「開始」してください',
        }],
      });
      return;
    }

    if (session.payments.length === 0) {
      await client.replyMessage({
        replyToken,
        messages: [{
          type: 'text',
          text: '⚠️ 支払い記録がありません',
        }],
      });
      return;
    }

    // 収支計算
    const balances = Calculator.calculateBalances(session.payments, session.members);
    const settlements = Calculator.calculateSettlements(balances);

    // セッション更新（精算と同時に終了）
    await storageService.updateSession(groupId, {
      settlements,
      status: 'completed',
    });

    // 返信メッセージ
    const message = MessageFormatter.formatSettlementMessage(session, balances, settlements)
      + '\n\nセッション終了しました💫';

    await client.replyMessage({
      replyToken,
      messages: [{ type: 'text', text: message }],
    });

    console.log(`✅ セッション精算・終了: ${groupId}`);
  }

  // 状況確認処理
  private async handleStatus(replyToken: string, groupId: string): Promise<void> {
    const session = await storageService.getSession(groupId);
    if (!session) {
      await client.replyMessage({
        replyToken,
        messages: [{
          type: 'text',
          text: '⚠️ まず「開始」してください',
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
          text: '⚠️ キャンセルする記録がありません',
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
        text: `✅ ${lastPayment.label} をキャンセルしました`,
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
          text: '⚠️ セッションがありません',
        }],
      });
      return;
    }

    await storageService.endSession(groupId);

    await client.replyMessage({
      replyToken,
      messages: [{
        type: 'text',
        text: 'OK！終了しました💫',
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
          text: '⚠️ まず「開始」してください',
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
          text: `⚠️ ${userProfile.displayName}さんは参加済みです`,
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

    // 返信メッセージ（簡潔に）
    const memberList = session.members.map(m => m.displayName).join(', ');
    const message = `⚡️現在の参加者：${session.members.length}名\n${memberList}`;

    await client.replyMessage({
      replyToken,
      messages: [{ type: 'text', text: message }],
    });
  }

  // グループ参加時のウェルカムメッセージ
  async handleJoin(event: line.WebhookEvent): Promise<void> {
    if (event.type !== 'join') return;

    const replyToken = event.replyToken;

    await client.replyMessage({
      replyToken,
      messages: [
        {
          type: 'text',
          text: `⚡️ 精算くんです！\nグループ専用の割り勘ツールです`
        },
        {
          type: 'text',
          text: `使い方:\n1️⃣「開始」\n2️⃣ 全員「参加」\n3️⃣ 支払い記録\n4️⃣「清算」\n詳しくは「ヘルプ」`
        }
      ],
    });

    console.log('✅ ウェルカムメッセージを送信しました');
  }

  // 友達追加時の処理
  async handleFollow(event: line.WebhookEvent): Promise<void> {
    if (event.type !== 'follow') return;

    const userId = event.source.userId;
    if (!userId) return;

    const replyToken = event.replyToken;

    try {
      // ユーザー情報を取得
      const profile = await client.getProfile(userId);

      // データベースに保存
      friendService.saveFriend({
        userId: profile.userId,
        displayName: profile.displayName,
        pictureUrl: profile.pictureUrl || undefined,
        statusMessage: profile.statusMessage || undefined,
        followedAt: new Date().toISOString(),
        isActive: true,
      });

      console.log(`👤 友達追加: ${profile.displayName} (${userId})`);

      // ウェルカムメッセージ
      await client.replyMessage({
        replyToken,
        messages: [
          {
            type: 'text',
            text: `${profile.displayName}さん、友達追加ありがとうございます！🎉\n\n清算くんは、グループでの割り勘を簡単にするBotです。`
          },
          {
            type: 'text',
            text: `📝 使い方\n\n1️⃣ 友達とのLINEグループに私を追加\n2️⃣ グループで「開始」と送信\n3️⃣ メンバー全員が「参加」と送信\n4️⃣ 支払いを記録\n   例：1軒目 5000円\n   例：タクシー 2000\n5️⃣ 最後に「精算」と送信`
          },
          {
            type: 'text',
            text: `💡 ポイント\n\n・自動で割り勘を計算します\n・誰がいくら払えばいいか表示\n・個別チャットでは統計機能も使えます\n\n詳しくは「ヘルプ」と送信してください！`
          }
        ],
      });
    } catch (error) {
      console.error('❌ 友達追加処理エラー:', error);

      // エラー時も簡単なメッセージは送る
      await client.replyMessage({
        replyToken,
        messages: [{
          type: 'text',
          text: `友達追加ありがとうございます！\n\n清算くんはグループでの割り勘を簡単にするBotです。\nグループに追加して「開始」と送信してください。`
        }],
      });
    }
  }

  // 友達解除（ブロック）時の処理
  async handleUnfollow(event: line.WebhookEvent): Promise<void> {
    if (event.type !== 'unfollow') return;

    const userId = event.source.userId;
    if (!userId) return;

    try {
      // データベースを更新
      friendService.unfollowFriend(userId);

      console.log(`👋 ブロック/友達解除: ${userId}`);
    } catch (error) {
      console.error('❌ アンフォロー処理エラー:', error);
    }
  }
}

export const commandHandler = new CommandHandler();
