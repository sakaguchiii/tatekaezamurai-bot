# 清算くん - SQLiteマイグレーション計画書

## 📋 目次
1. [プロジェクト概要](#プロジェクト概要)
2. [現状分析](#現状分析)
3. [アーキテクチャ設計](#アーキテクチャ設計)
4. [開発計画](#開発計画)
5. [テスト計画](#テスト計画)
6. [移行計画](#移行計画)
7. [リスク管理](#リスク管理)
8. [運用計画](#運用計画)
9. [成功指標](#成功指標)
10. [タイムライン](#タイムライン)

---

## プロジェクト概要

### 目的
現在のJSONファイルベースのデータ管理から、SQLiteを活用したハイブリッドアーキテクチャへ移行し、以下を実現する：
- **LINE Webhook応答速度の維持・向上（1秒以内必達）**
- データ分析機能の追加
- 将来的なスケーラビリティの確保
- データの整合性・信頼性の向上

### スコープ
- ✅ データストレージ層の完全リニューアル
- ✅ メモリキャッシュ層の導入
- ✅ 既存機能の維持（後方互換性）
- ✅ 分析基盤の構築
- ✅ バックアップ・復旧機能の強化
- ❌ UI/UXの変更（ユーザーには透過的）
- ❌ 新機能の追加（移行後に実施）

### 制約条件
- **環境**: Raspberry Pi（メモリ・CPU制約あり）
- **応答速度**: LINE Webhook 3秒以内必須、**実質1秒以内必達**
- **ダウンタイム**: 最小化（理想は0、最大30分）
- **データ損失**: 許容不可（完全バックアップ必須）
- **ユーザー**: 現在1グループのみ（テスト環境として活用可能）
- **更新方法**: 標準更新手順で対応可能であること
  ```bash
  pm2 stop tatekaezamurai
  cd ~/tatekaezamurai-bot
  git pull origin main
  cd server
  npm run build
  pm2 restart tatekaezamurai
  pm2 logs tatekaezamurai --lines 20
  ```

---

## 現状分析

### 現在のアーキテクチャ

```
LINE Webhook
    ↓
Express Server
    ↓
StorageService (JSON)
    ↓
sessions.json (単一ファイル)
```

### 現在のデータ構造

```json
{
  "group_001": {
    "sessionId": "uuid-xxx",
    "groupId": "group_001",
    "members": [
      {
        "userId": "U123",
        "displayName": "太郎",
        "balance": 0
      }
    ],
    "payments": [
      {
        "id": "pay-001",
        "payerId": "U123",
        "payerDisplayName": "太郎",
        "label": "一軒目",
        "amount": 5000,
        "participants": ["U123", "U456"],
        "timestamp": "2025-01-21T10:00:00Z",
        "isDeleted": false
      }
    ],
    "status": "active",
    "createdAt": "2025-01-21T10:00:00Z",
    "updatedAt": "2025-01-21T10:30:00Z"
  }
}
```

### 現在の問題点

| 問題 | 影響 | 優先度 |
|------|------|--------|
| 全データ読み込み必須 | パフォーマンス低下 | 高 |
| 複雑な検索不可 | 分析機能なし | 中 |
| 同時書き込み制御が複雑 | バグのリスク | 高 |
| データ増加でパフォーマンス悪化 | スケーラビリティ | 高 |
| 履歴検索が困難 | ユーザー体験 | 中 |

### パフォーマンス測定（ベースライン）

```
【現在のJSON方式】
- セッション取得: 5-10ms (1グループ時)
- セッション更新: 20-50ms
- 支払い記録: 20-50ms
- 清算計算: 10-20ms
- LINE返信までの総時間: 100-500ms ✅ 目標達成

【想定：100グループ時】
- セッション取得: 500ms+
- セッション更新: 1000ms+
- LINE返信までの総時間: 1500ms+ ❌ 目標未達
```

---

## アーキテクチャ設計

### 新アーキテクチャ概要図

```
┌──────────────────────────────────────────┐
│         LINE Webhook (応答3秒制限)        │
└────────────────┬─────────────────────────┘
                 │
                 ↓ <15ms (署名検証 + 200 OK)
┌──────────────────────────────────────────┐
│       Express Server (非同期処理)         │
└────────────────┬─────────────────────────┘
                 │
                 ↓
┌──────────────────────────────────────────┐
│  Layer 1: CacheService (メモリキャッシュ)  │
│  - アクティブセッションのみ保持             │
│  - 読み込み: <1ms                         │
│  - 書き込み: 即座に反映 + DB非同期更新     │
│  【目標】LINE返信まで 200-800ms           │
└────────────────┬─────────────────────────┘
                 │
                 ↓ (非同期)
┌──────────────────────────────────────────┐
│  Layer 2: DatabaseService (SQLite)       │
│  - WALモード (並行読み込み可能)           │
│  - ハイブリッドスキーマ (構造化 + JSON)    │
│  - バッチ書き込み (トランザクション)       │
└────────────────┬─────────────────────────┘
                 │
                 ↓ (日次)
┌──────────────────────────────────────────┐
│  Layer 3: BackupService                  │
│  - SQLite自動バックアップ (毎日3:00)      │
│  - JSON形式エクスポート (災害対策)        │
│  - 7日間保持                              │
└──────────────────────────────────────────┘
```

### データフロー

#### 読み込みフロー（目標: <50ms）
```
1. LINE: メッセージ受信
   ↓
2. Express: Webhook処理
   ↓
3. CommandHandler: コマンド解析
   ↓
4. CacheService.getSession(groupId)
   ├─ キャッシュにある → 即座に返却 (<1ms)
   └─ キャッシュにない → DB読み込み → キャッシュ登録 (10-20ms)
   ↓
5. ビジネスロジック実行 (10-50ms)
   ↓
6. LINE API: 返信送信 (100-300ms)

【合計】200-400ms（目標1秒以内を余裕で達成）
```

#### 書き込みフロー（目標: <10ms）
```
1. CacheService.updateSession(groupId, data)
   ↓
2. [同期] キャッシュを即座に更新 (<1ms)
   ↓
3. [非同期] 書き込みキューに追加
   ↓
4. [100ms後] キューをまとめてDB書き込み
   ↓
5. DatabaseService.batchUpdate(sessions)
   ↓ トランザクション
6. SQLite: COMMIT

【ユーザー体験】<10ms（応答に影響なし）
```

### データベーススキーマ

#### sessions テーブル
```sql
CREATE TABLE sessions (
  id TEXT PRIMARY KEY,              -- セッションID (UUID)
  group_id TEXT NOT NULL,           -- LINEグループID (検索用)
  status TEXT NOT NULL              -- active/settled/completed
    CHECK(status IN ('active', 'settled', 'completed')),
  created_at TEXT NOT NULL,         -- ISO8601形式
  updated_at TEXT NOT NULL,         -- ISO8601形式
  data TEXT NOT NULL                -- JSON形式で全データ保存
);

-- インデックス
CREATE INDEX idx_sessions_group ON sessions(group_id);
CREATE INDEX idx_sessions_status ON sessions(status);
CREATE INDEX idx_sessions_created ON sessions(created_at);
```

#### analytics_events テーブル（将来の分析用）
```sql
CREATE TABLE analytics_events (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  event_type TEXT NOT NULL,         -- payment/settle/start/end
  group_id TEXT,
  user_id TEXT,
  session_id TEXT,
  amount INTEGER,                   -- 金額（該当する場合）
  label TEXT,                       -- 項目名（該当する場合）
  created_at TEXT NOT NULL,
  metadata TEXT                     -- JSON形式で追加情報
);

CREATE INDEX idx_analytics_type ON analytics_events(event_type);
CREATE INDEX idx_analytics_created ON analytics_events(created_at);
CREATE INDEX idx_analytics_user ON analytics_events(user_id);
```

### モジュール構成

```
server/src/
├── services/
│   ├── cacheService.ts          [新規] メモリキャッシュ管理
│   ├── databaseService.ts       [新規] SQLite操作
│   ├── storageService.ts        [変更] キャッシュ+DB統合
│   ├── backupService.ts         [新規] バックアップ管理
│   └── analyticsService.ts      [新規] 分析イベント記録
├── migrations/
│   ├── 001_initial_schema.sql   [新規] 初期スキーマ
│   ├── migrate.ts               [新規] マイグレーション実行
│   └── rollback.ts              [新規] ロールバック処理
├── scripts/
│   ├── json-to-sqlite.ts        [新規] データ移行スクリプト
│   ├── verify-migration.ts      [新規] 移行検証スクリプト
│   └── export-json.ts           [新規] SQLite→JSON エクスポート
└── tests/
    ├── cache.test.ts            [新規] キャッシュテスト
    ├── database.test.ts         [新規] DBテスト
    └── integration.test.ts      [新規] 統合テスト
```

**ファイル名規約:**
- コードファイル（.ts, .js）: 英語（キャメルケース）
- ドキュメント（.md）: 日本語OK
- ログファイル: 日本語OK

---

## 開発計画

### Phase 1: 基盤構築（Week 1-2）

#### Week 1: 設計・準備

**Day 1-2: 環境構築**
- [ ] 開発ブランチ作成 `feature/sqlite-migration`
- [ ] 依存関係追加
  ```bash
  npm install better-sqlite3
  npm install @types/better-sqlite3 --save-dev
  npm install node-cron
  npm install @types/node-cron --save-dev
  ```
- [ ] ディレクトリ構成作成
- [ ] `.gitignore` 更新（`*.db`, `*.db-wal`, `*.db-shm` 追加）

**Day 3-4: スキーマ設計・実装**
- [ ] `migrations/001_initial_schema.sql` 作成
- [ ] `databaseService.ts` 基本実装
  - [ ] コンストラクタ（DB接続、WALモード設定）
  - [ ] スキーマ初期化
  - [ ] 基本CRUD操作
- [ ] ユニットテスト作成

**Day 5-7: キャッシュ層実装**
- [ ] `cacheService.ts` 実装
  - [ ] Map ベースのキャッシュ
  - [ ] TTL（Time To Live）設定
  - [ ] 書き込みキュー
  - [ ] バッチフラッシュ処理
- [ ] ユニットテスト作成

#### Week 2: 統合・移行準備

**Day 8-10: storageService リファクタリング**
- [ ] 既存の `storageService.ts` をラッパーに変更
- [ ] キャッシュ優先、DB フォールバック
- [ ] 既存のインターフェース維持（後方互換性）
- [ ] エラーハンドリング強化
- [ ] 統合テスト作成

**Day 11-12: 移行スクリプト作成**
- [ ] `json-to-sqlite.ts` 実装
  - [ ] 既存JSONファイル読み込み
  - [ ] データ検証
  - [ ] SQLite へ挿入
  - [ ] 検証レポート生成
- [ ] `verify-migration.ts` 実装
  - [ ] JSON vs SQLite データ比較
  - [ ] 差分レポート
- [ ] Dry-run モード実装

**Day 13-14: バックアップシステム**
- [ ] `backupService.ts` 実装
  - [ ] SQLite バックアップ
  - [ ] JSON エクスポート
  - [ ] cron スケジューリング
  - [ ] 古いバックアップ削除
- [ ] バックアップからの復元テスト

### Phase 2: テスト・検証（Week 3）

#### Week 3: 総合テスト

**Day 15-16: パフォーマンステスト**
- [ ] ベンチマークスクリプト作成
- [ ] 目標値との比較
  - [ ] 読み込み: <1ms (キャッシュヒット)
  - [ ] 読み込み: <20ms (キャッシュミス)
  - [ ] 書き込み: <5ms (キャッシュ更新)
  - [ ] **LINE返信まで: <1秒（最重要）**
- [ ] ラズパイ実機でのテスト

**Day 17-18: 負荷テスト**
- [ ] 同時アクセステスト（10グループ同時操作）
- [ ] 大量データテスト（100セッション）
- [ ] 長時間稼働テスト（24時間）
- [ ] メモリリークチェック

**Day 19-20: 統合テスト**
- [ ] 実際のLINE Webhookシミュレーション
- [ ] エラーケーステスト
  - [ ] DB接続失敗
  - [ ] ディスク容量不足
  - [ ] データ破損
- [ ] リカバリーテスト

**Day 21: バッファ日**
- [ ] 発見した問題の修正
- [ ] ドキュメント更新

### Phase 3: デプロイ・移行（Week 4）

#### Week 4: 本番移行

**Day 22: 移行準備**
- [ ] ラズパイに開発環境構築
- [ ] 依存関係インストール確認
- [ ] ディスク容量確認（最低1GB空き必要）
- [ ] 現行システムの完全バックアップ

**Day 23: ステージング環境での最終テスト**
- [ ] ラズパイの別ディレクトリに構築
- [ ] 本番データのコピーで移行テスト
- [ ] 動作確認（全コマンド実行）
- [ ] ロールバック手順確認

**Day 24: 本番移行実行**

**移行時刻**: 深夜2:00-3:00（使用頻度が低い時間帯）

**Day 25-26: 監視期間**
- [ ] ログ監視（エラー発生確認）
- [ ] パフォーマンス監視（特に応答速度）
- [ ] ユーザーフィードバック収集
- [ ] 軽微な問題の修正

**Day 27-28: 安定化・最適化**
- [ ] パフォーマンスチューニング
- [ ] 不要なログ削除
- [ ] ドキュメント最終化
- [ ] 旧JSONファイルのアーカイブ

---

## テスト計画

### テストレベル

#### 1. ユニットテスト

**対象モジュール:**
- cacheService.ts
- databaseService.ts
- backupService.ts
- analyticsService.ts

**テストフレームワーク:** Jest

**カバレッジ目標:** 80%以上

#### 2. パフォーマンステスト

**最重要指標:**

| 操作 | 目標値 | 必達ライン | 測定方法 |
|------|--------|-----------|----------|
| **LINE返信まで（総時間）** | **<500ms** | **<1秒** | E2Eテスト |
| キャッシュヒット（読み込み） | <1ms | <5ms | 1000回の平均 |
| キャッシュミス（読み込み） | <20ms | <50ms | 100回の平均 |
| キャッシュ更新 | <5ms | <10ms | 1000回の平均 |
| DB直接読み込み | <50ms | <100ms | 100回の平均 |

**ベンチマークスクリプト:**
```typescript
// benchmark.ts
import { performance } from 'perf_hooks';

async function benchmarkLineResponseTime() {
  const iterations = 100;
  const results = [];

  for (let i = 0; i < iterations; i++) {
    const start = performance.now();

    // 実際のLINE Webhookフローをシミュレート
    await webhookHandler({
      type: 'message',
      message: { text: '一軒目 5000' },
      source: { groupId: 'test-group' }
    });

    const end = performance.now();
    results.push(end - start);
  }

  const avg = results.reduce((a, b) => a + b) / results.length;
  const p99 = results.sort()[Math.floor(results.length * 0.99)];

  console.log(`LINE応答時間 平均: ${avg.toFixed(2)}ms`);
  console.log(`LINE応答時間 99%ile: ${p99.toFixed(2)}ms`);

  if (p99 > 1000) {
    console.error('❌ 目標未達: 1秒以内に応答できていません');
    process.exit(1);
  }

  console.log('✅ 目標達成: 1秒以内に応答しています');
}
```

#### 3. 負荷テスト

**シナリオ: 100グループの同時操作**

目標: 全グループで1秒以内の応答を維持

#### 4. E2Eテスト（LINE Webhook シミュレーション）

```typescript
// integration.test.ts
describe('LINE Webhook E2E（応答速度重視）', () => {
  it('開始から清算まで全て1秒以内に応答', async () => {
    const operations = [
      { command: '開始', maxTime: 800 },
      { command: '参加', maxTime: 500 },
      { command: '一軒目 5000', maxTime: 800 },
      { command: '状況', maxTime: 600 },
      { command: '清算', maxTime: 1000 }
    ];

    for (const op of operations) {
      const start = Date.now();
      await sendLineMessage(op.command);
      const elapsed = Date.now() - start;

      console.log(`${op.command}: ${elapsed}ms`);
      expect(elapsed).toBeLessThan(op.maxTime);
    }
  });
});
```

---

## 移行計画

### 移行前チェックリスト

#### 1週間前
- [ ] 全テストの完了確認
- [ ] ドキュメント整備完了
- [ ] バックアップ手順の確認
- [ ] ロールバック手順の確認
- [ ] 移行スクリプトの最終テスト
- [ ] ユーザーへの事前通知（LINEグループ）

#### 1日前
- [ ] 本番環境のバックアップ
- [ ] ディスク容量確認
- [ ] 依存関係の事前インストール
- [ ] ステージング環境での最終リハーサル

#### 移行当日（開始前）
- [ ] 全バックアップの確認
- [ ] サーバーヘルスチェック
- [ ] ログの初期化
- [ ] 移行時刻の最終確認

### 移行手順（標準更新手順で実行）

#### Step 1: メンテナンス開始（2:00）

```bash
# 1. メンテナンス通知（手動でLINEに投稿）
# 「清算くんのメンテナンスを2:00-3:00に実施します。」
# 「一時的に利用できなくなります。ご了承ください。」

# 2. 現在のログを確認
cd ~/tatekaezamurai-bot/server
pm2 logs tatekaezamurai --lines 50 > ~/migration-pre.log
```

#### Step 2: バックアップ（2:05）

```bash
# 完全バックアップ
BACKUP_DIR=~/backups/migration_$(date +%Y%m%d-%H%M%S)
mkdir -p $BACKUP_DIR

# データファイル
cp -r ~/tatekaezamurai-bot/server/src/data $BACKUP_DIR/

# 設定ファイル
cp ~/tatekaezamurai-bot/server/.env $BACKUP_DIR/

# プロジェクト全体（念のため）
cd ~/tatekaezamurai-bot
tar -czf $BACKUP_DIR/full-backup.tar.gz .

# バックアップ確認
ls -lh $BACKUP_DIR
```

#### Step 3: 標準更新手順で移行（2:10）

```bash
# 🚀 Raspberry Piでの標準更新手順
pm2 stop tatekaezamurai
cd ~/tatekaezamurai-bot
git pull origin main
cd server
npm run build
pm2 restart tatekaezamurai
pm2 logs tatekaezamurai --lines 20

# ※初回起動時にマイグレーションが自動実行される
```

#### Step 4: 動作確認（2:25）

```bash
# 1. ヘルスチェック
curl http://localhost:3000/health

# 2. LINEボットで実際に操作
# - 「ヘルプ」と送信
# - 「開始」→「参加」→「テスト 100」→「清算」
# - 応答速度を体感確認（1秒以内か？）
```

#### Step 5: 完了処理（2:45）

```bash
# 1. 移行ログ保存
pm2 logs tatekaezamurai --lines 100 > ~/migration-post.log

# 2. 完了通知（手動でLINEに投稿）
# 「メンテナンスが完了しました！」
# 「引き続きご利用ください。」
```

### ロールバック手順

```bash
# 緊急ロールバック（5分以内に実行）

# 1. サーバー停止
pm2 stop tatekaezamurai

# 2. 旧バージョンに戻す
cd ~/tatekaezamurai-bot
git checkout main
git reset --hard HEAD~1  # 1コミット前に戻る

# 3. バックアップからデータ復元
BACKUP_DIR=~/backups/migration_YYYYMMDD-HHMMSS
cp -r $BACKUP_DIR/data/* ~/tatekaezamurai-bot/server/src/data/

# 4. 旧バージョンビルド
cd server
npm run build

# 5. サーバー再起動
pm2 restart tatekaezamurai

# 6. 動作確認
curl http://localhost:3000/health
pm2 logs tatekaezamurai --lines 20
```

---

## リスク管理

### リスク一覧と対策

| リスクID | リスク内容 | 影響度 | 発生確率 | 対策 |
|----------|-----------|--------|----------|------|
| R1 | データ移行失敗 | 高 | 中 | 完全バックアップ、dry-run、検証スクリプト |
| R2 | **応答速度が1秒超過** | **高** | **中** | **ベンチマーク、最適化、ロールバック** |
| R3 | DB破損 | 高 | 低 | WALモード、日次バックアップ |
| R4 | パフォーマンス悪化 | 中 | 中 | ベンチマーク、最適化 |
| R5 | メモリ不足 | 中 | 低 | キャッシュサイズ制限、監視 |
| R6 | 標準更新手順で対応不可 | 中 | 低 | 事前検証、リハーサル |

### 応答速度保証のための対策

**対策1: 非同期処理の徹底**
- Webhook応答を即座に返す（<15ms）
- DB書き込みは全て非同期化

**対策2: キャッシュ活用**
- アクティブセッションは全てメモリに
- キャッシュヒット率 95%以上を目標

**対策3: 継続的な監視**
- 応答速度ログを自動記録
- 1秒超過時にアラート

---

## 運用計画

### 日常運用

#### 監視項目

**システム監視（自動）**
```bash
# cron で定期実行
# /etc/cron.d/tatekaezamurai-monitor

# 5分ごとにヘルスチェック
*/5 * * * * curl -f http://localhost:3000/health || echo "Health check failed"

# 毎日3:00にバックアップ
0 3 * * * cd ~/tatekaezamurai-bot/server && npm run backup
```

**手動監視（週次）**
- [ ] PM2ステータス確認 `pm2 status`
- [ ] ディスク使用量確認 `df -h`
- [ ] メモリ使用量確認 `free -h`
- [ ] ログの異常確認 `pm2 logs tatekaezamurai --lines 100 | grep ERROR`
- [ ] **応答速度確認（最重要）**

#### バックアップ運用

**自動バックアップ（日次）**
```bash
# server/src/scripts/backup.sh
#!/bin/bash

BACKUP_DIR=~/backups/daily
DATE=$(date +%Y%m%d)
DB_FILE=~/tatekaezamurai-bot/server/src/data/database.db

mkdir -p $BACKUP_DIR

# SQLiteバックアップ
cp $DB_FILE $BACKUP_DIR/database_$DATE.db

# JSON形式でもエクスポート
cd ~/tatekaezamurai-bot/server
npm run export-json > $BACKUP_DIR/sessions_$DATE.json

# 7日以上前のバックアップを削除
find $BACKUP_DIR -name "*.db" -mtime +7 -delete
find $BACKUP_DIR -name "*.json" -mtime +7 -delete

echo "バックアップ完了: $DATE"
```

### アップデート運用（標準手順）

```bash
# 🚀 通常アップデート
pm2 stop tatekaezamurai
cd ~/tatekaezamurai-bot
git pull origin main
cd server
npm run build
pm2 restart tatekaezamurai
pm2 logs tatekaezamurai --lines 20
```

### トラブルシューティング

#### 問題1: サーバーが起動しない

**対処:**
```bash
# 1. ログ確認
pm2 logs tatekaezamurai --lines 50

# 2. 環境変数確認
cat ~/tatekaezamurai-bot/server/.env

# 3. 手動起動してエラー確認
cd ~/tatekaezamurai-bot/server
npm start
```

#### 問題2: 応答が1秒以上かかる

**対処:**
```bash
# 1. パフォーマンス測定
cd ~/tatekaezamurai-bot/server
npm run benchmark

# 2. キャッシュ状況確認
# ログで「キャッシュミス」が多発していないか確認

# 3. DB最適化
sqlite3 src/data/database.db "VACUUM;"

# 4. 改善しない場合はロールバック
```

---

## 成功指標

### KPI（主要指標）

| 指標 | 移行前 | 目標値 | 必達ライン | 測定方法 |
|------|--------|--------|-----------|----------|
| **LINE応答速度（平均）** | **50ms** | **<500ms** | **<1秒** | ログ分析 |
| **LINE応答速度（99%）** | **200ms** | **<800ms** | **<1秒** | ログ分析 |
| ダウンタイム | - | <30分 | <60分 | 移行時計測 |
| データ損失 | - | 0件 | 0件 | 検証スクリプト |
| エラー率 | <1% | <1% | <2% | ログ分析 |

### 成功基準

**必須（Must Have）**
- ✅ **全ての操作が1秒以内に応答する**
- ✅ 全データが正常に移行されている
- ✅ 全ての既存機能が動作する
- ✅ 標準更新手順で対応可能

**推奨（Should Have）**
- ✅ 応答速度が向上している
- ✅ メモリ使用量が許容範囲内
- ✅ バックアップが正常に動作する

---

## タイムライン

### ガントチャート

```
Week 1: 基盤構築
├─ Day 1-2: 環境構築
├─ Day 3-4: スキーマ設計・実装
└─ Day 5-7: キャッシュ層実装

Week 2: 統合・移行準備
├─ Day 8-10: storageService リファクタリング
├─ Day 11-12: 移行スクリプト作成
└─ Day 13-14: バックアップシステム

Week 3: テスト・検証
├─ Day 15-16: パフォーマンステスト（応答速度重点）
├─ Day 17-18: 負荷テスト
├─ Day 19-20: 統合テスト
└─ Day 21: バッファ日

Week 4: デプロイ・移行
├─ Day 22: 移行準備
├─ Day 23: ステージング最終テスト
├─ Day 24: 本番移行実行（標準更新手順）
└─ Day 25-28: 監視・安定化
```

### マイルストーン

| マイルストーン | 予定日 | 完了基準 |
|---------------|--------|----------|
| M1: 開発環境構築完了 | Day 2 | 依存関係インストール、ビルド成功 |
| M2: DB層実装完了 | Day 7 | ユニットテスト全てパス |
| M3: 統合完了 | Day 14 | 統合テスト全てパス |
| M4: テスト完了 | Day 21 | 全テストパス、パフォーマンス目標達成 |
| M5: 本番移行完了 | Day 24 | 移行成功、動作確認OK |
| M6: 安定稼働確認 | Day 28 | 1週間エラーなし |

---

## 付録

### A. ファイル・ログ名規約

**コードファイル（英語）:**
- `cacheService.ts`
- `databaseService.ts`
- `backupService.ts`
- `migrate.ts`
- `benchmark.ts`

**ドキュメントファイル（日本語OK）:**
- `SQLiteマイグレーション計画書.md`
- `運用手順書.md`
- `トラブルシューティング.md`

**ログファイル（日本語OK）:**
- `migration-pre.log`
- `migration-post.log`
- `error.log`

**バックアップディレクトリ:**
- `~/backups/daily/`
- `~/backups/migration_20250122/`

### B. コマンド一覧

```bash
# 開発
npm run dev              # 開発サーバー起動
npm run build            # ビルド
npm test                 # テスト実行

# マイグレーション
npm run migrate          # 本番マイグレーション
npm run migrate:dry      # Dry-run
npm run verify           # 移行検証

# バックアップ
npm run backup           # 手動バックアップ
npm run restore          # 復元

# メンテナンス
npm run vacuum           # DB最適化
npm run export-json      # JSON エクスポート
npm run benchmark        # パフォーマンステスト

# 標準更新手順（Raspberry Pi）
pm2 stop tatekaezamurai
cd ~/tatekaezamurai-bot
git pull origin main
cd server
npm run build
pm2 restart tatekaezamurai
pm2 logs tatekaezamurai --lines 20
```

### C. 用語集

| 用語 | 説明 |
|------|------|
| WALモード | Write-Ahead Logging。読み込みと書き込みを並行実行可能にするSQLiteの機能 |
| キャッシュヒット | メモリキャッシュからデータを取得できること |
| キャッシュミス | メモリキャッシュになく、DBから取得が必要な状態 |
| トランザクション | 複数の操作を1つの単位として実行する仕組み |
| VACUUM | データベースファイルを最適化してサイズを削減する操作 |

---

**ドキュメントバージョン:** 1.0
**最終更新日:** 2025-01-22
**次回レビュー予定:** 移行完了後1週間
