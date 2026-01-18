import { Session, Member, Balance, Settlement } from '../types';

export class MessageFormatter {
  // 開始メッセージ
  static formatStartMessage(members: Member[]): string {
    const memberList = members.map((m) => `・${m.displayName}さん`).join('\n');

    return `🍻 たてかえ侍を開始します！

【参加メンバー(${members.length}名)】
${memberList}

支払いを記録するには:
「一軒目 14000円」のように入力してください

💡 使い方を見る → 「ヘルプ」`;
  }

  // 支払い記録メッセージ
  static formatPaymentMessage(
    label: string,
    amount: number,
    paidByName: string,
    memberCount: number,
    perPerson: number,
    totalAmount: number
  ): string {
    return `✅ ${label}を記録しました

💰 金額: ${amount.toLocaleString()}円
👤 立替: ${paidByName}さん
👥 参加: ${memberCount}名
💴 1人あたり: ${perPerson.toLocaleString()}円

現在の合計: ${totalAmount.toLocaleString()}円`;
  }

  // 清算メッセージ
  static formatSettlementMessage(
    session: Session,
    balances: Balance[],
    settlements: Settlement[]
  ): string {
    // 支払い済み額の集計
    const paidByPerson: { [name: string]: number } = {};
    session.payments
      .filter((p) => !p.isDeleted)
      .forEach((p) => {
        paidByPerson[p.paidBy.displayName] = (paidByPerson[p.paidBy.displayName] || 0) + p.amount;
      });

    const paidList = Object.entries(paidByPerson)
      .map(([name, amount]) => `💵 ${name}さん: ${amount.toLocaleString()}円`)
      .join('\n');

    const totalAmount = Object.values(paidByPerson).reduce((sum, amt) => sum + amt, 0);
    const perPerson = Math.floor(totalAmount / session.members.length);

    // 送金一覧
    let settlementList = '';
    if (settlements.length > 0) {
      settlementList = settlements
        .map(
          (s) => `${s.from.displayName}さん → ${s.to.displayName}さん
💴 ${s.amount.toLocaleString()}円
📲 PayPay送金
${s.paypayLink}
`
        )
        .join('\n');
    }

    return `💰 清算結果

━━━━━━━━━━━━━━━━
【支払い済み】
${paidList}
合計: ${totalAmount.toLocaleString()}円

【1人あたり負担】
${perPerson.toLocaleString()}円 × ${session.members.length}名

━━━━━━━━━━━━━━━━
${settlements.length > 0 ? '【送金が必要】\n\n' + settlementList : '全員精算済みです!'}
${
  settlements.length > 0
    ? `━━━━━━━━━━━━━━━━
⏰ リマインダー設定
3日後に未送金の方へリマインドします

送金完了したら「完了 @自分→相手」と入力`
    : ''
}`;
  }

  // 状況確認メッセージ
  static formatStatusMessage(session: Session): string {
    const payments = session.payments
      .filter((p) => !p.isDeleted)
      .map((p) => `${p.label}: ${p.amount.toLocaleString()}円 (${p.paidBy.displayName}さん)`)
      .join('\n');

    const totalAmount = session.payments
      .filter((p) => !p.isDeleted)
      .reduce((sum, p) => sum + p.amount, 0);

    return `📊 現在の状況

【支払い記録】
${payments || 'まだ記録がありません'}

【合計金額】
${totalAmount.toLocaleString()}円

【参加メンバー】
${session.members.length}名

「清算」と入力すると精算結果が表示されます`;
  }

  // ヘルプメッセージ
  static formatHelpMessage(): string {
    return `📖 清算くんの使い方

【基本的な流れ】
1️⃣ 「開始」または「はじめ」でセッション開始
2️⃣ 参加者全員が「参加」と入力
3️⃣ 支払いを記録（ラベル + スペース + 金額）
4️⃣ 「清算」または「せいさん」で精算結果を表示

【コマンド一覧】
☑︎ 開始 / はじめ - セッション開始
☑︎ 参加 / さんか - 参加登録（必須！）
☑︎ 状況 / 確認 - 現在の記録確認
☑︎ 清算 / せいさん - 精算結果表示
☑︎ キャンセル / 取消 - 最後の記録削除
☑︎ 終了 / おわり - セッション終了
☑︎ ヘルプ / ? - この画面を表示

【記録例】
一軒目 14000円
ラーメン 500
タクシー代 3,000円
カラオケ 5000

⚠️ 書き方のルール
・ラベル名 + スペース（半角・全角OK）+ 金額
・金額は半角数字
・「円」は省略可能
・カンマ区切りOK

💡 支払いを記録する前に、必ず「参加」で登録してください！`;
  }
}
