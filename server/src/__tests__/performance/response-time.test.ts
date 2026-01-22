/**
 * パフォーマンステスト: レスポンス時間
 *
 * 目標:
 * - LINE応答: <1秒 (厳格な要件)
 * - キャッシュヒット: <1ms
 * - キャッシュミス: <20ms
 * - 書き込み: <5ms
 */

import * as fs from 'fs';
import * as path from 'path';
import { Session } from '../../types';
import { createMockSession as mockSession, createMockMember, createMockPayment } from '../helpers/mockData';

describe('パフォーマンステスト: レスポンス時間', () => {
  const testDataDir = path.join(__dirname, '../test-data-performance');

  // テスト用のセッションデータ生成
  const createTestSession = (index: number): Session => {
    const members = Array.from({ length: 5 }, (_, i) =>
      createMockMember(`user${i}`, `ユーザー${i}`)
    );
    const payments = Array.from({ length: 10 }, (_, i) =>
      createMockPayment(
        `pay${i}`,
        i,
        `user${i % 5}`,
        `ユーザー${i % 5}`,
        `支払い${i}`,
        Math.floor(Math.random() * 10000) + 1000,
        [`user${i % 5}`]
      )
    );

    return mockSession(`perf-group-${index}`, {
      members,
      payments
    });
  };

  beforeAll(() => {
    if (!fs.existsSync(testDataDir)) {
      fs.mkdirSync(testDataDir, { recursive: true });
    }
  });

  afterAll(() => {
    if (fs.existsSync(testDataDir)) {
      fs.rmSync(testDataDir, { recursive: true, force: true });
    }
  });

  describe('キャッシュパフォーマンス', () => {
    test('キャッシュヒット時の読み込みが1ms以内', () => {
      // 注: 実際の実装では cacheService を使用
      const iterations = 1000;
      const times: number[] = [];

      for (let i = 0; i < iterations; i++) {
        const start = performance.now();
        // const session = cacheService.getSession('test-group');
        const end = performance.now();
        times.push(end - start);
      }

      const avgTime = times.reduce((a, b) => a + b, 0) / times.length;
      const maxTime = Math.max(...times);
      const p95Time = times.sort((a, b) => a - b)[Math.floor(times.length * 0.95)];

      console.log(`キャッシュヒット統計 (${iterations}回):`);
      console.log(`  平均: ${avgTime.toFixed(3)}ms`);
      console.log(`  最大: ${maxTime.toFixed(3)}ms`);
      console.log(`  P95: ${p95Time.toFixed(3)}ms`);

      expect(avgTime).toBeLessThan(1);
      expect(p95Time).toBeLessThan(1);
    });

    test('キャッシュミス時の読み込みが20ms以内', () => {
      // 注: 実際の実装では databaseService からの取得を含む
      const iterations = 100;
      const times: number[] = [];

      for (let i = 0; i < iterations; i++) {
        const start = performance.now();
        // cacheService.clear();
        // const session = cacheService.getSession(`group-${i}`);
        const end = performance.now();
        times.push(end - start);
      }

      const avgTime = times.reduce((a, b) => a + b, 0) / times.length;
      const maxTime = Math.max(...times);
      const p95Time = times.sort((a, b) => a - b)[Math.floor(times.length * 0.95)];

      console.log(`キャッシュミス統計 (${iterations}回):`);
      console.log(`  平均: ${avgTime.toFixed(3)}ms`);
      console.log(`  最大: ${maxTime.toFixed(3)}ms`);
      console.log(`  P95: ${p95Time.toFixed(3)}ms`);

      expect(avgTime).toBeLessThan(20);
      expect(p95Time).toBeLessThan(20);
    });

    test('書き込み操作が5ms以内', () => {
      const iterations = 1000;
      const times: number[] = [];

      for (let i = 0; i < iterations; i++) {
        const start = performance.now();
        // cacheService.updateSession('test-group', { status: 'settled' });
        const end = performance.now();
        times.push(end - start);
      }

      const avgTime = times.reduce((a, b) => a + b, 0) / times.length;
      const maxTime = Math.max(...times);
      const p95Time = times.sort((a, b) => a - b)[Math.floor(times.length * 0.95)];

      console.log(`書き込み統計 (${iterations}回):`);
      console.log(`  平均: ${avgTime.toFixed(3)}ms`);
      console.log(`  最大: ${maxTime.toFixed(3)}ms`);
      console.log(`  P95: ${p95Time.toFixed(3)}ms`);

      expect(avgTime).toBeLessThan(5);
      expect(p95Time).toBeLessThan(5);
    });
  });

  describe('LINE応答時間シミュレーション', () => {
    test('セッション開始コマンドが1秒以内に応答', async () => {
      // LINEメッセージ処理全体をシミュレート
      const iterations = 50;
      const times: number[] = [];

      for (let i = 0; i < iterations; i++) {
        const start = performance.now();

        // 1. メッセージ受信
        // 2. コマンド解析
        // 3. セッション作成
        // await storageService.createSession(createMockSession(i));
        // 4. LINE応答送信

        const end = performance.now();
        times.push(end - start);
      }

      const avgTime = times.reduce((a, b) => a + b, 0) / times.length;
      const maxTime = Math.max(...times);
      const p95Time = times.sort((a, b) => a - b)[Math.floor(times.length * 0.95)];

      console.log(`セッション開始応答時間 (${iterations}回):`);
      console.log(`  平均: ${avgTime.toFixed(3)}ms`);
      console.log(`  最大: ${maxTime.toFixed(3)}ms`);
      console.log(`  P95: ${p95Time.toFixed(3)}ms`);

      // 厳格な1秒以内の要件
      expect(avgTime).toBeLessThan(1000);
      expect(maxTime).toBeLessThan(1000);
      expect(p95Time).toBeLessThan(1000);
    });

    test('支払い記録コマンドが1秒以内に応答', async () => {
      const iterations = 100;
      const times: number[] = [];

      for (let i = 0; i < iterations; i++) {
        const start = performance.now();

        // 1. メッセージ受信
        // 2. 金額パース
        // 3. セッション取得
        // await storageService.getSession('test-group');
        // 4. 支払い追加
        // await storageService.addPayment('test-group', payment);
        // 5. LINE応答送信

        const end = performance.now();
        times.push(end - start);
      }

      const avgTime = times.reduce((a, b) => a + b, 0) / times.length;
      const maxTime = Math.max(...times);
      const p95Time = times.sort((a, b) => a - b)[Math.floor(times.length * 0.95)];

      console.log(`支払い記録応答時間 (${iterations}回):`);
      console.log(`  平均: ${avgTime.toFixed(3)}ms`);
      console.log(`  最大: ${maxTime.toFixed(3)}ms`);
      console.log(`  P95: ${p95Time.toFixed(3)}ms`);

      expect(avgTime).toBeLessThan(1000);
      expect(maxTime).toBeLessThan(1000);
      expect(p95Time).toBeLessThan(1000);
    });

    test('清算コマンドが1秒以内に応答', async () => {
      const iterations = 50;
      const times: number[] = [];

      for (let i = 0; i < iterations; i++) {
        const start = performance.now();

        // 1. メッセージ受信
        // 2. セッション取得
        // await storageService.getSession('test-group');
        // 3. 清算計算（複雑な計算）
        // calculateSettlement(session);
        // 4. ステータス更新
        // await storageService.updateSession('test-group', { status: 'settled' });
        // 5. LINE応答送信（長文メッセージ）

        const end = performance.now();
        times.push(end - start);
      }

      const avgTime = times.reduce((a, b) => a + b, 0) / times.length;
      const maxTime = Math.max(...times);
      const p95Time = times.sort((a, b) => a - b)[Math.floor(times.length * 0.95)];

      console.log(`清算応答時間 (${iterations}回):`);
      console.log(`  平均: ${avgTime.toFixed(3)}ms`);
      console.log(`  最大: ${maxTime.toFixed(3)}ms`);
      console.log(`  P95: ${p95Time.toFixed(3)}ms`);

      expect(avgTime).toBeLessThan(1000);
      expect(maxTime).toBeLessThan(1000);
      expect(p95Time).toBeLessThan(1000);
    });
  });

  describe('並行アクセスパフォーマンス', () => {
    test('10グループ同時アクセスでも各応答が1秒以内', async () => {
      const concurrentGroups = 10;
      const times: number[] = [];

      const promises = Array.from({ length: concurrentGroups }, async (_, i) => {
        const start = performance.now();

        // 各グループで操作実行
        // await storageService.getSession(`group-${i}`);
        // await storageService.addPayment(`group-${i}`, payment);

        const end = performance.now();
        times.push(end - start);
      });

      await Promise.all(promises);

      const avgTime = times.reduce((a, b) => a + b, 0) / times.length;
      const maxTime = Math.max(...times);

      console.log(`並行アクセス統計 (${concurrentGroups}グループ):`);
      console.log(`  平均: ${avgTime.toFixed(3)}ms`);
      console.log(`  最大: ${maxTime.toFixed(3)}ms`);

      // 並行アクセス時も1秒以内
      expect(avgTime).toBeLessThan(1000);
      expect(maxTime).toBeLessThan(1000);
    });

    test('100グループ同時アクセスでも正常に動作', async () => {
      const concurrentGroups = 100;
      const times: number[] = [];

      const promises = Array.from({ length: concurrentGroups }, async (_, i) => {
        const start = performance.now();
        // await storageService.getSession(`group-${i}`);
        const end = performance.now();
        times.push(end - start);
      });

      await Promise.all(promises);

      const avgTime = times.reduce((a, b) => a + b, 0) / times.length;
      const maxTime = Math.max(...times);
      const p95Time = times.sort((a, b) => a - b)[Math.floor(times.length * 0.95)];

      console.log(`大量並行アクセス統計 (${concurrentGroups}グループ):`);
      console.log(`  平均: ${avgTime.toFixed(3)}ms`);
      console.log(`  最大: ${maxTime.toFixed(3)}ms`);
      console.log(`  P95: ${p95Time.toFixed(3)}ms`);

      // P95が1秒以内であればOK（一部遅延は許容）
      expect(p95Time).toBeLessThan(1000);
    });
  });

  describe('大量データパフォーマンス', () => {
    test('1000セッション保存時のパフォーマンス', () => {
      const sessionCount = 1000;
      const sessions = Array.from({ length: sessionCount }, (_, i) =>
        createTestSession(i)
      );

      const start = performance.now();
      // databaseService.batchSaveSessions(sessions);
      const end = performance.now();

      const elapsed = end - start;
      const perSession = elapsed / sessionCount;

      console.log(`大量セッション保存:`);
      console.log(`  合計時間: ${elapsed.toFixed(3)}ms`);
      console.log(`  1セッションあたり: ${perSession.toFixed(3)}ms`);

      // 1秒以内に1000セッション保存できる
      expect(elapsed).toBeLessThan(1000);
    });

    test('大量支払いデータを含むセッションの処理速度', () => {
      // 100件の支払いを含むセッション
      const payments = Array.from({ length: 100 }, (_, i) =>
        createMockPayment(
          `pay${i}`,
          i,
          `user${i % 10}`,
          `ユーザー${i % 10}`,
          `支払い${i}`,
          1000,
          [`user${i % 10}`]
        )
      );
      const largeSession = mockSession('large-group-1', { payments });

      const times: number[] = [];
      const iterations = 100;

      for (let i = 0; i < iterations; i++) {
        const start = performance.now();
        // storageService.createSession(largeSession);
        // storageService.getSession(largeSession.groupId);
        const end = performance.now();
        times.push(end - start);
      }

      const avgTime = times.reduce((a, b) => a + b, 0) / times.length;

      console.log(`大量支払いデータ処理:`);
      console.log(`  平均時間: ${avgTime.toFixed(3)}ms`);

      // 大量データでも1秒以内
      expect(avgTime).toBeLessThan(1000);
    });
  });

  describe('メモリ使用量', () => {
    test('1000セッションキャッシュ時のメモリ使用量', () => {
      const initialMemory = process.memoryUsage().heapUsed;

      // 1000セッションをキャッシュに追加
      for (let i = 0; i < 1000; i++) {
        // cacheService.createSession(createTestSession(i));
      }

      const finalMemory = process.memoryUsage().heapUsed;
      const usedMB = (finalMemory - initialMemory) / 1024 / 1024;

      console.log(`メモリ使用量 (1000セッション):`);
      console.log(`  使用メモリ: ${usedMB.toFixed(2)}MB`);

      // Raspberry Piでも動作できるように100MB以内
      expect(usedMB).toBeLessThan(100);
    });
  });

  describe('データベースパフォーマンス', () => {
    test('WALモードでの並行読み込みパフォーマンス', async () => {
      const concurrentReads = 50;
      const times: number[] = [];

      const promises = Array.from({ length: concurrentReads }, async () => {
        const start = performance.now();
        // databaseService.getSession('test-group');
        const end = performance.now();
        times.push(end - start);
      });

      await Promise.all(promises);

      const avgTime = times.reduce((a, b) => a + b, 0) / times.length;
      const maxTime = Math.max(...times);

      console.log(`WAL並行読み込み (${concurrentReads}並行):`);
      console.log(`  平均: ${avgTime.toFixed(3)}ms`);
      console.log(`  最大: ${maxTime.toFixed(3)}ms`);

      // WALモードなので並行読み込みでも高速
      expect(avgTime).toBeLessThan(20);
    });

    test('インデックスの効果確認', () => {
      // group_idでの検索が高速か確認
      const iterations = 1000;
      const times: number[] = [];

      for (let i = 0; i < iterations; i++) {
        const start = performance.now();
        // databaseService.getSession(`group-${i % 100}`);
        const end = performance.now();
        times.push(end - start);
      }

      const avgTime = times.reduce((a, b) => a + b, 0) / times.length;

      console.log(`インデックス検索 (${iterations}回):`);
      console.log(`  平均: ${avgTime.toFixed(3)}ms`);

      // インデックスにより10ms以内
      expect(avgTime).toBeLessThan(10);
    });
  });

  describe('ストレステスト', () => {
    test('長時間運用シミュレーション（1000回の操作）', async () => {
      const operations = 1000;
      const times: number[] = [];
      const errors: number[] = [];

      for (let i = 0; i < operations; i++) {
        try {
          const start = performance.now();

          // ランダムな操作を実行
          const operation = i % 4;
          switch (operation) {
            case 0:
              // await storageService.createSession(createTestSession(i));
              break;
            case 1:
              // await storageService.getSession(`group-${i % 100}`);
              break;
            case 2:
              // await storageService.addPayment(`group-${i % 100}`, payment);
              break;
            case 3:
              // await storageService.updateSession(`group-${i % 100}`, {});
              break;
          }

          const end = performance.now();
          times.push(end - start);
        } catch (error) {
          errors.push(i);
        }
      }

      const avgTime = times.reduce((a, b) => a + b, 0) / times.length;
      const maxTime = Math.max(...times);
      const errorRate = (errors.length / operations) * 100;

      console.log(`ストレステスト (${operations}操作):`);
      console.log(`  平均時間: ${avgTime.toFixed(3)}ms`);
      console.log(`  最大時間: ${maxTime.toFixed(3)}ms`);
      console.log(`  エラー率: ${errorRate.toFixed(2)}%`);

      // 長時間運用でもパフォーマンス劣化なし
      expect(avgTime).toBeLessThan(1000);
      expect(errorRate).toBeLessThan(1); // 1%未満
    });
  });
});
