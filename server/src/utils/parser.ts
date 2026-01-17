export class CommandParser {
  // 「開始」コマンド
  static isStartCommand(text: string): boolean {
    return text.trim() === '開始';
  }

  // 支払い記録コマンド(一軒目 14000円)
  static parsePaymentCommand(text: string): { label: string; amount: number } | null {
    // 正規表現: 一軒目/1軒目 14000/14,000 円(オプション)
    const regex = /^([一二三四1234]軒目|追加)\s*(\d{1,3}(?:,\d{3})*|\d+)円?/;
    const match = text.match(regex);

    if (!match) return null;

    const label = match[1];
    const amountStr = match[2].replace(/,/g, ''); // カンマ除去
    const amount = parseInt(amountStr, 10);

    if (amount <= 0) return null;

    return { label, amount };
  }

  // 清算コマンド
  static isSettleCommand(text: string): boolean {
    return text.trim() === '清算';
  }

  // 状況確認コマンド
  static isStatusCommand(text: string): boolean {
    return text.trim() === '状況';
  }

  // キャンセルコマンド
  static isCancelCommand(text: string): boolean {
    return text.trim() === 'キャンセル';
  }

  // ヘルプコマンド
  static isHelpCommand(text: string): boolean {
    return text.trim() === 'ヘルプ';
  }

  // 終了コマンド
  static isEndCommand(text: string): boolean {
    return text.trim() === '終了';
  }
}
