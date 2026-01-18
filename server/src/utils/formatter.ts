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

1️⃣ 開始
2️⃣ 全員「参加」
3️⃣ 支払い記録（例: 一軒目 5000円）
4️⃣ 清算

コマンド:
開始/参加/状況/清算/終了/?

記録例:
ラーメン 500
タクシー 3000
カラオケ 5,000円`;
  }
}
