import { Payment, Member, Balance, Settlement } from '../types';

export class Calculator {
  // 各メンバーの収支を計算
  static calculateBalances(payments: Payment[], members: Member[]): Balance[] {
    const balances: { [userId: string]: Balance } = {};

    // 初期化
    members.forEach((m) => {
      balances[m.userId] = {
        userId: m.userId,
        displayName: m.displayName,
        paid: 0,
        owes: 0,
        balance: 0,
      };
    });

    // 各支払いを処理
    payments.forEach((payment) => {
      if (payment.isDeleted) return;

      const participantCount = payment.participants.length;
      const perPerson = Math.round(payment.amount / participantCount);

      // 立替者に加算
      if (balances[payment.paidBy.userId]) {
        balances[payment.paidBy.userId].paid += payment.amount;
      }

      // 参加者全員の負担額に加算
      payment.participants.forEach((userId) => {
        if (balances[userId]) {
          balances[userId].owes += perPerson;
        }
      });
    });

    // 差額計算
    Object.keys(balances).forEach((userId) => {
      balances[userId].balance = balances[userId].paid - balances[userId].owes;
    });

    return Object.values(balances);
  }

  // 最適な送金パターンを計算(貪欲法)
  static calculateSettlements(balances: Balance[]): Settlement[] {
    const settlements: Settlement[] = [];

    // 債務者と債権者に分ける
    const debtors = balances
      .filter((b) => b.balance < 0)
      .map((b) => ({ ...b, amount: -b.balance }))
      .sort((a, b) => b.amount! - a.amount!);

    const creditors = balances
      .filter((b) => b.balance > 0)
      .map((b) => ({ ...b, amount: b.balance }))
      .sort((a, b) => b.amount! - a.amount!);

    let i = 0;
    let j = 0;

    while (i < debtors.length && j < creditors.length) {
      const debtor = debtors[i];
      const creditor = creditors[j];
      const amount = Math.min(debtor.amount!, creditor.amount!);

      settlements.push({
        from: {
          userId: debtor.userId,
          displayName: debtor.displayName,
        },
        to: {
          userId: creditor.userId,
          displayName: creditor.displayName,
        },
        amount: amount,
        status: 'pending',
        paypayLink: this.generatePayPayLink(creditor.userId, amount),
        linePayLink: this.generateLinePayLink(creditor.userId, amount),
      });

      debtor.amount! -= amount;
      creditor.amount! -= amount;

      if (debtor.amount === 0) i++;
      if (creditor.amount === 0) j++;
    }

    return settlements;
  }

  // PayPayリンク生成(仮実装)
  static generatePayPayLink(recipientId: string, amount: number): string {
    // 実際のPayPay APIを使用する場合は要調査
    return `https://pay.paypay.ne.jp/?amount=${amount}&to=${recipientId}`;
  }

  // LINE Payリンク生成(仮実装)
  static generateLinePayLink(recipientId: string, amount: number): string {
    return `https://line.me/R/pay/?amount=${amount}&to=${recipientId}`;
  }
}
