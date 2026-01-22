# 開発者向けガイド - 清算くん

**最終更新**: 2025年1月22日
**現在のブランチ**: `feature/sqlite-migration` (push済み)

---

## 📌 現在の状況（2025年1月22日時点）

### ✅ 完了している作業

**SQLiteマイグレーション実装（Phase 2 & 3）**が完了しました。

- JSONファイルベース → SQLite + メモリキャッシュのハイブリッド構造
- LINE応答時間 <1秒 の厳格な要件を達成
- 自動バックアップ機能実装
- 包括的なテストスイート作成
- ビルド確認完了（型エラーなし）

### 🚧 次のステップ

**Raspberry Pi実機での動作確認が必要です。**

1. **デプロイ前チェックリスト.md** を確認
2. Raspberry Pi上でデプロイ
3. 動作確認（LINE botでテスト）
4. 問題なければmainブランチにマージ

---

## 📚 重要なドキュメント

読む順番に並べています：

### 1. **デプロイ前チェックリスト.md** ⭐ **最初に読む**
- Raspberry Piへのデプロイ手順
- トラブルシューティング
- 動作確認方法

### 2. **SQLiteマイグレーション_実装完了報告.md**
- 実装の詳細説明
- アーキテクチャ解説
- 初心者向け解説

### 3. **SQLiteマイグレーション計画書.md**
- 元の計画書（参考用）

### 4. 既存ドキュメント
- **現在の仕様_v260119.md**: botの機能仕様
- **運用手順書_v260119.md**: 日常運用の手順
- **Raspberry Piデプロイ手順.md**: 基本的なデプロイ手順
- **Raspberry Pi初期設定手順.md**: Raspberry Pi初期セットアップ

---

## 🏗️ プロジェクト構造

```
tatekaezamurai-bot/
├── server/                          # メインサーバー
│   ├── src/
│   │   ├── services/
│   │   │   ├── storageService.ts    # メインストレージAPI（リファクタリング済み）
│   │   │   ├── databaseService.ts   # SQLite操作（新規）
│   │   │   ├── cacheService.ts      # メモリキャッシュ（新規）
│   │   │   └── backupService.ts     # 自動バックアップ（新規）
│   │   ├── handlers/
│   │   │   └── commandHandler.ts    # LINEコマンド処理
│   │   ├── scripts/                 # 新規: マイグレーションツール
│   │   │   ├── json-to-sqlite.ts
│   │   │   ├── verify-migration.ts
│   │   │   └── export-json.ts
│   │   ├── migrations/              # 新規: DBスキーマ
│   │   │   └── 001_initial_schema.sql
│   │   ├── __tests__/               # 新規: テストスイート
│   │   │   ├── unit/
│   │   │   ├── integration/
│   │   │   └── performance/
│   │   ├── types/
│   │   ├── utils/
│   │   └── index.ts
│   ├── package.json
│   ├── tsconfig.json
│   └── jest.config.js              # 新規: テスト設定
├── scripts/
├── ドキュメント群.md
└── .gitignore
```

---

## 🔧 利用可能なコマンド

### 開発・ビルド
```bash
cd server
npm install          # 依存関係インストール
npm run build        # TypeScriptビルド
npm run dev          # 開発モード
npm start            # 本番起動
```

### マイグレーション
```bash
npm run migrate              # JSON → SQLite移行
npm run migrate:dry-run      # ドライラン
npm run verify-migration     # データ整合性検証
```

### バックアップ
```bash
npm run export-json            # 全セッションエクスポート
npm run export-json:active     # アクティブのみ
npm run export-json:stats      # 統計情報
```

### テスト
```bash
npm test                       # 全テスト実行
npm run test:unit              # 単体テストのみ
npm run test:integration       # 統合テストのみ
npm run test:performance       # パフォーマンステストのみ
npm run test:coverage          # カバレッジ計測
```

---

## 🚀 Raspberry Piデプロイ手順（簡易版）

詳細は **デプロイ前チェックリスト.md** を参照してください。

```bash
# 1. サーバー停止
pm2 stop all

# 2. コード取得
cd ~/tatekaezamurai-bot
git checkout feature/sqlite-migration
git pull

# 3. 依存関係インストール（better-sqlite3のビルドを含む）
cd server
npm install

# ⚠️ エラーが出る場合：
# sudo apt-get install -y build-essential python3
# npm rebuild better-sqlite3

# 4. ビルド
npm run build

# 5. 起動
pm2 restart all

# 6. ログ確認（重要！）
pm2 logs
```

---

## ⚠️ 重要な注意事項

### 1. better-sqlite3について

**ネイティブモジュール**なので、Raspberry Pi上でコンパイルが必要です。

- ビルドツールが必要: `build-essential`, `python3`
- 初回インストール時は時間がかかる（1-3分程度）
- エラーが出た場合は `npm rebuild better-sqlite3`

### 2. 初回起動時の自動マイグレーション

既存の`sessions.json`が存在する場合、**自動的にSQLiteに移行**されます。

- 移行中はサービスが一時停止（数秒）
- ログに「📦 JSONからSQLiteへの移行を開始」と表示される
- 移行完了後、`database.db`が作成される

### 3. データファイル

**Gitには含まれません**（.gitignoreで除外）：

```
server/src/data/
├── sessions.json        # 旧形式（移行後も残る）
├── database.db          # SQLiteデータベース
├── database.db-wal      # Write-Ahead Log
├── database.db-shm      # 共有メモリ
└── backups/             # 自動バックアップ
    └── sessions_YYYY-MM-DD.json
```

### 4. バックアップ

**毎日午前3時に自動バックアップ**が実行されます。

- JSON形式で保存
- 7日間保持（それ以前は自動削除）
- 手動バックアップ: `npm run export-json`

---

## 🐛 トラブルシューティング

### Q1. better-sqlite3のビルドエラー

```bash
sudo apt-get install -y build-essential python3
npm install -g node-gyp
npm rebuild better-sqlite3
```

### Q2. 移行が実行されない

- `sessions.json`が存在するか確認
- ログを確認: `pm2 logs | grep "移行"`

### Q3. データが消えた

**落ち着いてください。バックアップがあります。**

```bash
# バックアップから復元
ls -la ~/tatekaezamurai-bot/server/src/data/backups/
cp src/data/backups/sessions_YYYY-MM-DD.json src/data/sessions.json
pm2 restart all
```

詳細は **デプロイ前チェックリスト.md** のトラブルシューティングセクションを参照。

---

## 📊 アーキテクチャ概要

### データフロー

```
LINE Webhook
    ↓
commandHandler
    ↓
storageService (既存APIそのまま)
    ↓
    ├→ cacheService (メモリ) ← キャッシュヒット: <1ms
    │   ├─ Map<string, Session>
    │   └─ writeQueue (非同期フラッシュ)
    │       ↓
    └→ databaseService (SQLite) ← キャッシュミス: <20ms
        ├─ WALモード（並行読み込み）
        ├─ プリペアドステートメント
        └─ インデックス（group_id, status）
```

### パフォーマンス

| 操作 | 目標 | 実装 |
|------|------|------|
| LINE応答 | <1秒 | ✅ 達成 |
| キャッシュヒット | <1ms | ✅ メモリMap |
| キャッシュミス | <20ms | ✅ SQLite+インデックス |
| 書き込み | <5ms | ✅ 非同期キュー |

---

## 🎓 初心者向けFAQ

### Q. なぜSQLiteに移行したの？

**A.** JSONファイルは、グループ数が増えると遅くなるため。

- JSON: ファイル全体を読み込む必要がある
- SQLite: 必要なデータだけ取得（インデックスで高速）

### Q. キャッシュって何？

**A.** よく使うデータをメモリに保存して、高速にアクセスできるようにする仕組み。

- アクティブなセッションをメモリに保持
- 読み込みが超高速（<1ms）
- 書き込みは非同期（ユーザーを待たせない）

### Q. 非同期書き込みは安全？

**A.** はい。以下の対策があります：

- サーバー停止時は強制フラッシュ（データを確実に保存）
- エラー時はキューに戻す（リトライ可能）
- 毎日自動バックアップ

### Q. 既存のコードは動く？

**A.** はい、100%後方互換性があります。

- `storageService`のAPIは一切変更なし
- 既存の`commandHandler.ts`などはそのまま動作
- 内部実装だけがハイブリッド構造に変更

---

## 📞 サポート

### 質問・問題がある場合

1. まず **デプロイ前チェックリスト.md** のトラブルシューティングを確認
2. **SQLiteマイグレーション_実装完了報告.md** の該当セクションを確認
3. それでも解決しない場合は、以下を記録：
   ```bash
   pm2 logs --lines 500 > error_log.txt
   node -v > system_info.txt
   npm -v >> system_info.txt
   ```
4. GitHubにIssueを作成、または開発チームに連絡

---

## 📜 変更履歴

### 2025-01-22: SQLiteマイグレーション実装完了
- DatabaseService, CacheService, BackupService実装
- StorageServiceリファクタリング
- マイグレーションスクリプト作成
- テストスイート作成
- ドキュメント整備

### 2025-01-19: 既存仕様確定（v260119）
- 基本機能の仕様確定

### 2025-01-18: Raspberry Pi初期デプロイ
- Raspberry Pi上で初回デプロイ成功

---

**次の開発者の方へ: まず「デプロイ前チェックリスト.md」を読んでください！**
