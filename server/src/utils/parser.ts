export class CommandParser {
  // 「開始」コマンド
  static isStartCommand(text: string): boolean {
    const normalized = text.trim().toLowerCase();
    return normalized === '開始' || normalized === 'はじめ' || normalized === 'start';
  }

  // 「参加」コマンド
  static isJoinMemberCommand(text: string): boolean {
    const normalized = text.trim().toLowerCase();
    return normalized === '参加' || normalized === 'さんか' || normalized === 'join';
  }

  // 支払い記録コマンド(一軒目 14000円)
  static parsePaymentCommand(text: string): { label: string; amount: number } | null {
    // 正規表現: 柔軟なラベル + 金額
    // 半角・全角スペース両対応
    // 例: 一軒目 2000円、ラーメン　500円、タクシー代 3000
    const regex = /^(.+?)[\s　]+([\d,]+)円?$/;
    const match = text.trim().match(regex);

    if (!match) return null;

    const label = match[1].trim();
    const amountStr = match[2].replace(/,/g, ''); // カンマ除去
    const amount = parseInt(amountStr, 10);

    // 金額チェック
    if (isNaN(amount) || amount <= 0) return null;

    // ラベルが空でないことを確認
    if (!label) return null;

    return { label, amount };
  }

  // 清算コマンド
  static isSettleCommand(text: string): boolean {
    const normalized = text.trim().toLowerCase();
    return normalized === '清算' || normalized === 'せいさん' || normalized === '精算' || normalized === 'settle';
  }

  // 状況確認コマンド
  static isStatusCommand(text: string): boolean {
    const normalized = text.trim().toLowerCase();
    return normalized === '状況' || normalized === '確認' || normalized === 'じょうきょう' || normalized === 'status';
  }

  // キャンセルコマンド
  static isCancelCommand(text: string): boolean {
    const normalized = text.trim().toLowerCase();
    return normalized === 'キャンセル' || normalized === 'きゃんせる' || normalized === '取消' || normalized === 'cancel';
  }

  // ヘルプコマンド
  static isHelpCommand(text: string): boolean {
    const normalized = text.trim().toLowerCase();
    return normalized === 'ヘルプ' || normalized === 'へるぷ' || normalized === '使い方' || normalized === 'help' || normalized === '?';
  }

  // 終了コマンド
  static isEndCommand(text: string): boolean {
    const normalized = text.trim().toLowerCase();
    return normalized === '終了' || normalized === 'しゅうりょう' || normalized === 'おわり' || normalized === 'end';
  }

  // 履歴コマンド
  static isHistoryCommand(text: string): boolean {
    const normalized = text.trim().toLowerCase();
    return normalized.startsWith('履歴') || normalized.startsWith('りれき') || normalized.startsWith('history');
  }

  // 履歴コマンドをパース
  static parseHistoryCommand(text: string): { limit?: number; months?: number } | null {
    const normalized = text.trim();

    // 入力検証
    if (!normalized || normalized.length > 50) {
      return null;
    }

    // 「履歴」だけの場合
    if (/^(履歴|りれき|history)$/i.test(normalized)) {
      return { limit: 10 }; // デフォルト10件
    }

    // 「履歴 20」のような件数指定
    const limitMatch = normalized.match(/^(履歴|りれき|history)[\s　]+(\d+)$/i);
    if (limitMatch) {
      const limit = parseInt(limitMatch[2], 10);
      // 厳格な検証: 1-100の範囲、整数のみ
      if (Number.isInteger(limit) && limit >= 1 && limit <= 100) {
        return { limit };
      }
      return null; // 範囲外の場合はnullを返す
    }

    // 「履歴 1月」「履歴 3ヶ月」のような期間指定
    const monthsMatch = normalized.match(/^(履歴|りれき|history)[\s　]+(\d+)(月|ヶ月|ヵ月|か月|カ月)$/i);
    if (monthsMatch) {
      const months = parseInt(monthsMatch[2], 10);
      // 厳格な検証: 1-12の範囲、整数のみ
      if (Number.isInteger(months) && months >= 1 && months <= 12) {
        return { months };
      }
      return null; // 範囲外の場合はnullを返す
    }

    return null;
  }

  // 統計コマンド
  static isStatsCommand(text: string): boolean {
    const normalized = text.trim().toLowerCase();
    return normalized === '統計' || normalized === 'とうけい' || normalized === 'stats';
  }
}
