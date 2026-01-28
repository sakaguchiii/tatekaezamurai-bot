/**
 * CommandParser ユニットテスト
 */

import { CommandParser } from '../../utils/parser';

describe('CommandParser', () => {
  describe('履歴コマンド検出（isHistoryCommand）', () => {
    test('正常: 「履歴」を検出', () => {
      expect(CommandParser.isHistoryCommand('履歴')).toBe(true);
    });

    test('正常: 「りれき」を検出', () => {
      expect(CommandParser.isHistoryCommand('りれき')).toBe(true);
    });

    test('正常: 「history」を検出', () => {
      expect(CommandParser.isHistoryCommand('history')).toBe(true);
    });

    test('正常: 「履歴 10」を検出', () => {
      expect(CommandParser.isHistoryCommand('履歴 10')).toBe(true);
    });

    test('正常: 「履歴 3ヶ月」を検出', () => {
      expect(CommandParser.isHistoryCommand('履歴 3ヶ月')).toBe(true);
    });

    test('正常: 大文字小文字を区別しない', () => {
      expect(CommandParser.isHistoryCommand('HISTORY')).toBe(true);
      expect(CommandParser.isHistoryCommand('History')).toBe(true);
    });

    test('異常: 履歴コマンドではない', () => {
      expect(CommandParser.isHistoryCommand('ヘルプ')).toBe(false);
      expect(CommandParser.isHistoryCommand('統計')).toBe(false);
      expect(CommandParser.isHistoryCommand('開始')).toBe(false);
    });
  });

  describe('履歴コマンド解析（parseHistoryCommand）', () => {
    describe('正常系', () => {
      test('「履歴」のみ -> デフォルト10件', () => {
        const result = CommandParser.parseHistoryCommand('履歴');
        expect(result).toEqual({ limit: 10 });
      });

      test('「りれき」のみ -> デフォルト10件', () => {
        const result = CommandParser.parseHistoryCommand('りれき');
        expect(result).toEqual({ limit: 10 });
      });

      test('「history」のみ -> デフォルト10件', () => {
        const result = CommandParser.parseHistoryCommand('history');
        expect(result).toEqual({ limit: 10 });
      });

      test('「履歴 1」-> 1件', () => {
        const result = CommandParser.parseHistoryCommand('履歴 1');
        expect(result).toEqual({ limit: 1 });
      });

      test('「履歴 20」-> 20件', () => {
        const result = CommandParser.parseHistoryCommand('履歴 20');
        expect(result).toEqual({ limit: 20 });
      });

      test('「履歴 100」-> 100件（上限）', () => {
        const result = CommandParser.parseHistoryCommand('履歴 100');
        expect(result).toEqual({ limit: 100 });
      });

      test('「履歴 1月」-> 1ヶ月', () => {
        const result = CommandParser.parseHistoryCommand('履歴 1月');
        expect(result).toEqual({ months: 1 });
      });

      test('「履歴 3ヶ月」-> 3ヶ月', () => {
        const result = CommandParser.parseHistoryCommand('履歴 3ヶ月');
        expect(result).toEqual({ months: 3 });
      });

      test('「履歴 12ヶ月」-> 12ヶ月（上限）', () => {
        const result = CommandParser.parseHistoryCommand('履歴 12ヶ月');
        expect(result).toEqual({ months: 12 });
      });

      test('「履歴 3ヵ月」-> 3ヶ月（小さいヵ）', () => {
        const result = CommandParser.parseHistoryCommand('履歴 3ヵ月');
        expect(result).toEqual({ months: 3 });
      });

      test('「履歴 3か月」-> 3ヶ月（ひらがな）', () => {
        const result = CommandParser.parseHistoryCommand('履歴 3か月');
        expect(result).toEqual({ months: 3 });
      });

      test('「履歴 3カ月」-> 3ヶ月（カタカナ）', () => {
        const result = CommandParser.parseHistoryCommand('履歴 3カ月');
        expect(result).toEqual({ months: 3 });
      });

      test('全角スペースも対応', () => {
        const result = CommandParser.parseHistoryCommand('履歴　20');
        expect(result).toEqual({ limit: 20 });
      });
    });

    describe('異常系 - 範囲外の値', () => {
      test('limit 0 -> null', () => {
        const result = CommandParser.parseHistoryCommand('履歴 0');
        expect(result).toBeNull();
      });

      test('limit 101 -> null（上限超過）', () => {
        const result = CommandParser.parseHistoryCommand('履歴 101');
        expect(result).toBeNull();
      });

      test('limit 1000 -> null', () => {
        const result = CommandParser.parseHistoryCommand('履歴 1000');
        expect(result).toBeNull();
      });

      test('months 0 -> null', () => {
        const result = CommandParser.parseHistoryCommand('履歴 0ヶ月');
        expect(result).toBeNull();
      });

      test('months 13 -> null（上限超過）', () => {
        const result = CommandParser.parseHistoryCommand('履歴 13ヶ月');
        expect(result).toBeNull();
      });

      test('months 100 -> null', () => {
        const result = CommandParser.parseHistoryCommand('履歴 100ヶ月');
        expect(result).toBeNull();
      });
    });

    describe('異常系 - 不正な形式', () => {
      test('小数は無効', () => {
        const result = CommandParser.parseHistoryCommand('履歴 1.5');
        expect(result).toBeNull();
      });

      test('負の数は無効', () => {
        const result = CommandParser.parseHistoryCommand('履歴 -10');
        expect(result).toBeNull();
      });

      test('文字列は無効', () => {
        const result = CommandParser.parseHistoryCommand('履歴 abc');
        expect(result).toBeNull();
      });

      test('空文字列 -> null', () => {
        const result = CommandParser.parseHistoryCommand('');
        expect(result).toBeNull();
      });

      test('長すぎる入力 -> null（50文字超）', () => {
        const longInput = '履歴 ' + 'a'.repeat(50);
        const result = CommandParser.parseHistoryCommand(longInput);
        expect(result).toBeNull();
      });

      test('スペースなしは無効', () => {
        const result = CommandParser.parseHistoryCommand('履歴10');
        expect(result).toBeNull();
      });

      test('複数パラメータは無効', () => {
        const result = CommandParser.parseHistoryCommand('履歴 10 20');
        expect(result).toBeNull();
      });
    });
  });

  describe('統計コマンド検出（isStatsCommand）', () => {
    test('正常: 「統計」を検出', () => {
      expect(CommandParser.isStatsCommand('統計')).toBe(true);
    });

    test('正常: 「とうけい」を検出', () => {
      expect(CommandParser.isStatsCommand('とうけい')).toBe(true);
    });

    test('正常: 「stats」を検出', () => {
      expect(CommandParser.isStatsCommand('stats')).toBe(true);
    });

    test('正常: 大文字小文字を区別しない', () => {
      expect(CommandParser.isStatsCommand('STATS')).toBe(true);
      expect(CommandParser.isStatsCommand('Stats')).toBe(true);
    });

    test('正常: 前後の空白を削除', () => {
      expect(CommandParser.isStatsCommand('  統計  ')).toBe(true);
    });

    test('異常: 統計コマンドではない', () => {
      expect(CommandParser.isStatsCommand('ヘルプ')).toBe(false);
      expect(CommandParser.isStatsCommand('履歴')).toBe(false);
      expect(CommandParser.isStatsCommand('開始')).toBe(false);
    });
  });

  describe('既存コマンドとの整合性', () => {
    test('開始コマンド', () => {
      expect(CommandParser.isStartCommand('開始')).toBe(true);
      expect(CommandParser.isStartCommand('履歴')).toBe(false);
    });

    test('ヘルプコマンド', () => {
      expect(CommandParser.isHelpCommand('ヘルプ')).toBe(true);
      expect(CommandParser.isHelpCommand('help')).toBe(true);
      expect(CommandParser.isHelpCommand('履歴')).toBe(false);
    });

    test('履歴と統計は別コマンド', () => {
      expect(CommandParser.isHistoryCommand('履歴')).toBe(true);
      expect(CommandParser.isStatsCommand('履歴')).toBe(false);

      expect(CommandParser.isStatsCommand('統計')).toBe(true);
      expect(CommandParser.isHistoryCommand('統計')).toBe(false);
    });
  });
});
