import { Session, Member, Balance, Settlement } from '../types';

export class MessageFormatter {

  // 清算メッセージ（簡潔に）
  static formatSettlementMessage(
    session: Session,
    balances: Balance[],
    settlements: Settlement[]
  ): string {
    // 合計金額
    const totalAmount = session.payments
      .filter((p) => !p.isDeleted)
      .reduce((sum, p) => sum + p.amount, 0);

    const perPerson = Math.floor(totalAmount / session.members.length);

    // 送金一覧（簡潔に）
    if (settlements.length === 0) {
      return `✅ 精算完了！\n\n合計: ${totalAmount.toLocaleString()}円\n1人: ${perPerson.toLocaleString()}円`;
    }

    const settlementList = settlements
      .map((s) => `${s.from.displayName} → ${s.to.displayName}\n💴 ${s.amount.toLocaleString()}円`)
      .join('\n\n');

    return `💰 精算結果

合計: ${totalAmount.toLocaleString()}円
1人: ${perPerson.toLocaleString()}円 × ${session.members.length}名

【送金】
${settlementList}`;
  }

  // 状況確認メッセージ（簡潔に）
  static formatStatusMessage(session: Session): string {
    const payments = session.payments
      .filter((p) => !p.isDeleted)
      .map((p) => `${p.label}: ${p.amount.toLocaleString()}円`)
      .join('\n');

    const totalAmount = session.payments
      .filter((p) => !p.isDeleted)
      .reduce((sum, p) => sum + p.amount, 0);

    return `📊 現在の状況

${payments || '記録なし'}

合計: ${totalAmount.toLocaleString()}円
参加: ${session.members.length}名`;
  }

  // ヘルプメッセージ（簡潔に）
  static formatHelpMessage(): string {
    return `📖 使い方

1️⃣「開始」と入力
2️⃣ 全員「参加」と入力
3️⃣ 支払いを記録
4️⃣「清算」で計算

💡 記録の入力方法
【項目名 ｽﾍﾟｰｽ 金額】
例：一軒目　5000円
例：ラーメン　2000

コマンド:
開始/参加/状況/清算/終了/ヘルプ`;
  }

  // 履歴メッセージ
  static formatHistoryMessage(
    sessions: Session[],
    userId: string,
    options?: { limit?: number; months?: number }
  ): string {
    if (sessions.length === 0) {
      return '💳 清算履歴がありません';
    }

    const limit = options?.limit || 3;
    const monthsText = options?.months ? `${options.months}ヶ月分` : '';

    // 各セッションを「送金指示」中心に表示
    const historyList = sessions.map((session) => {
      // 日付フォーマット (YYYY/MM/DD)
      const date = new Date(session.createdAt);
      const dateStr = `${date.getFullYear()}/${String(date.getMonth() + 1).padStart(2, '0')}/${String(date.getDate()).padStart(2, '0')}`;

      const groupName = session.groupName || 'グループ';

      // 自分に関連する送金指示を抽出
      const mySettlements = session.settlements.filter(
        (s) => s.from.userId === userId || s.to.userId === userId
      );

      let settlementText = '';
      if (mySettlements.length === 0) {
        // 送金指示がない場合（支払い済みまたは立替なし）
        settlementText = '✅ 精算済み';
      } else {
        settlementText = mySettlements.map((s) => {
          if (s.from.userId === userId) {
            // 自分が送る側
            return `→ ${s.to.displayName}へ ¥${s.amount.toLocaleString()}`;
          } else {
            // 自分が受け取る側
            return `← ${s.from.displayName}から ¥${s.amount.toLocaleString()}`;
          }
        }).join('\n');
      }

      return `${dateStr} ${groupName}\n${settlementText}`;
    }).join('\n\n');

    const header = `💳 あなたの清算履歴${monthsText ? ` (${monthsText})` : ''} (最新${sessions.length}件)`;
    const footer = sessions.length >= limit
      ? `\n\n📊 「履歴 ${limit + 10}」で${limit + 10}件表示\n「履歴 3ヶ月」で期間指定\n「統計」で統計を表示`
      : `\n\n📊 「統計」で統計を表示`;

    return `${header}\n\n${historyList}${footer}`;
  }

  // 統計メッセージ
  static formatStatsMessage(stats: {
    totalSessions: number;
    totalAmount: number;
    thisMonthSessions: number;
    thisMonthAmount: number;
  }): string {
    const avgAmount = stats.totalSessions > 0
      ? Math.round(stats.totalAmount / stats.totalSessions)
      : 0;

    return `📊 あなたの統計

【全期間】
・参加回数: ${stats.totalSessions}回
・総支払額: ¥${stats.totalAmount.toLocaleString()}
・平均支払額: ¥${avgAmount.toLocaleString()}/回

【今月】
・参加回数: ${stats.thisMonthSessions}回
・支払額: ¥${stats.thisMonthAmount.toLocaleString()}

💡「履歴」で過去の清算を確認`;
  }
}
