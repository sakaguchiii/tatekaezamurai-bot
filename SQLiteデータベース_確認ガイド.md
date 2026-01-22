# 🗄️ SQLiteデータベース確認ガイド

**対象者**: データベースの中身を見たい人
**難易度**: 初心者でもOK

---

## 📦 SQLiteに入っているデータ

### 1. セッションデータ（sessions テーブル）

清算くんの**メインデータ**がここに保存されています。

| カラム名 | データ型 | 説明 | 例 |
|---------|---------|------|-----|
| `id` | TEXT | セッションID | `C48819908d9907fd2...` |
| `group_id` | TEXT | LINEグループID | `C48819908d9907fd2...` |
| `status` | TEXT | 状態 | `active`, `settled`, `completed` |
| `created_at` | TEXT | 作成日時 | `2026-01-22T13:45:00.000Z` |
| `updated_at` | TEXT | 更新日時 | `2026-01-22T14:30:00.000Z` |
| `data` | TEXT | セッション全体のJSON | `{"groupId":"...", "members":[...], ...}` |

**重要**: `data` カラムには、セッション全体の情報がJSON形式で保存されています：
- メンバー一覧
- 支払い履歴
- 精算結果
- その他すべての情報

### 2. 分析イベントデータ（analytics_events テーブル）

将来の拡張用に用意されています（現在はあまり使われていない）。

| カラム名 | データ型 | 説明 |
|---------|---------|------|
| `id` | INTEGER | イベントID（自動採番） |
| `event_type` | TEXT | イベントの種類 |
| `group_id` | TEXT | LINEグループID |
| `user_id` | TEXT | LINEユーザーID |
| `session_id` | TEXT | セッションID |
| `amount` | INTEGER | 金額 |
| `label` | TEXT | ラベル |
| `created_at` | TEXT | 作成日時 |
| `metadata` | TEXT | その他の情報（JSON） |

---

## 🔍 データの確認方法

### 方法1: コマンドライン（Raspberry Pi上）

**最もシンプルな方法**

```bash
# Raspberry Piに接続
ssh sk283@raspberrypi.local

# データベースに接続
cd ~/tatekaezamurai-bot/server
sqlite3 dist/data/database.db
```

SQLiteのプロンプトが表示されます：
```
SQLite version 3.37.2 2022-01-06 13:25:41
Enter ".help" for usage hints.
sqlite>
```

#### よく使うコマンド

```sql
-- 1. テーブル一覧を表示
.tables

-- 出力例:
-- analytics_events  sessions

-- 2. テーブルの構造を確認
.schema sessions

-- 出力例:
-- CREATE TABLE sessions (
--   id TEXT PRIMARY KEY,
--   group_id TEXT NOT NULL,
--   status TEXT NOT NULL,
--   ...
-- );

-- 3. セッション数を確認
SELECT COUNT(*) FROM sessions;

-- 出力例:
-- 8

-- 4. 最新5件のセッションを表示
SELECT id, group_id, status, created_at
FROM sessions
ORDER BY created_at DESC
LIMIT 5;

-- 5. ステータス別の件数
SELECT status, COUNT(*) as count
FROM sessions
GROUP BY status;

-- 出力例:
-- active|2
-- settled|3
-- completed|3

-- 6. 終了するとき
.exit
```

---

### 方法2: 見やすく表示する設定

SQLiteのデフォルト表示は見づらいので、設定を変更します：

```bash
sqlite3 dist/data/database.db
```

SQLiteプロンプト内で：
```sql
-- ヘッダーを表示
.headers on

-- カラムモードで表示（表形式）
.mode column

-- 幅を自動調整
.width auto

-- これで見やすくなる！
SELECT id, status, created_at FROM sessions LIMIT 3;
```

**出力例**:
```
id                                         status     created_at
-----------------------------------------  ---------  ------------------------
C48819908d9907fd29bf67958dc6de9f7          completed  2026-01-22T13:45:00.000Z
C5a234b8d9907fd29bf67958dc6de9f8          active     2026-01-22T15:30:00.000Z
C6b345c9d9907fd29bf67958dc6de9f9          settled    2026-01-23T10:00:00.000Z
```

---

### 方法3: JSONデータを見やすく表示

`data` カラムには全情報がJSON形式で入っていますが、そのままだと読みづらいです。

```sql
-- JSONの一部を取り出す
SELECT
  id,
  status,
  json_extract(data, '$.members') as members,
  json_extract(data, '$.payments') as payments
FROM sessions
LIMIT 1;
```

**もっと見やすく表示**:
```bash
# データを1つ取り出してファイルに保存
sqlite3 dist/data/database.db "SELECT data FROM sessions LIMIT 1;" > session.json

# 見やすく整形して表示
cat session.json | python3 -m json.tool
```

**出力例**:
```json
{
  "groupId": "C48819908d9907fd29bf67958dc6de9f7",
  "status": "completed",
  "members": [
    {
      "userId": "Ucdc6f609c888a5de55a124e70aa68d6d",
      "displayName": "太郎"
    }
  ],
  "payments": [
    {
      "venue": "1軒目",
      "amount": 5000,
      "timestamp": "2026-01-22T13:50:00.000Z"
    }
  ],
  "createdAt": "2026-01-22T13:45:00.000Z"
}
```

---

### 方法4: GUIツールを使う（Mac/Windows）

**初心者に最もおすすめ！**

#### A. DB Browser for SQLite（無料）

1. **ダウンロード**:
   - https://sqlitebrowser.org/
   - macOS、Windows、Linuxに対応

2. **データベースファイルを取得**:
   ```bash
   # Raspberry Piからダウンロード
   scp sk283@raspberrypi.local:~/tatekaezamurai-bot/server/dist/data/database.db ~/Desktop/
   ```

3. **開く**:
   - DB Browser for SQLiteを起動
   - 「データベースを開く」→ `database.db` を選択

4. **データを見る**:
   - 「データ閲覧」タブ
   - テーブル選択: `sessions`
   - 全データが表形式で表示される

5. **SQLを実行**:
   - 「SQL実行」タブ
   - クエリを入力して実行

**スクリーンショット（イメージ）**:
```
┌─────────────────────────────────────┐
│ DB Browser for SQLite              │
├─────────────────────────────────────┤
│ [データベース構造] [データ閲覧] [SQL実行] │
├─────────────────────────────────────┤
│ テーブル: sessions                  │
├───┬──────────┬─────────┬───────────┤
│id │ group_id │ status  │ created_at│
├───┼──────────┼─────────┼───────────┤
│C4 │ C488...  │ active  │ 2026-01-22│
│C5 │ C5a2...  │ settled │ 2026-01-22│
└───┴──────────┴─────────┴───────────┘
```

#### B. TablePlus（有料・無料版あり）

- https://tableplus.com/
- よりモダンなUI
- macOS、Windows、Linux対応
- 無料版でも基本機能は使える

#### C. DBeaver（無料）

- https://dbeaver.io/
- 多機能
- 少し複雑だが、プロフェッショナル向け

---

### 方法5: npmスクリプトで統計を見る

最も簡単な方法！

```bash
cd ~/tatekaezamurai-bot/server

# 統計情報を表示
npm run export-json:stats
```

**出力例**:
```
📊 データベース統計情報
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
📈 セッション数（ステータス別）:
   active: 2件
   settled: 3件
   completed: 3件

💰 支払い統計:
   総支払い件数: 25件
   総支払い金額: 125,000円

👥 メンバー統計:
   総メンバー数: 40名
   平均メンバー数: 5.0名/セッション
```

---

## 📊 実用的なクエリ集

### 1. 基本的な確認

```sql
-- 全セッション数
SELECT COUNT(*) as total_sessions FROM sessions;

-- ステータス別の件数
SELECT status, COUNT(*) as count
FROM sessions
GROUP BY status;

-- 最新10件
SELECT id, status, created_at
FROM sessions
ORDER BY created_at DESC
LIMIT 10;
```

### 2. 日付で絞り込み

```sql
-- 今日作成されたセッション
SELECT COUNT(*)
FROM sessions
WHERE DATE(created_at) = DATE('now');

-- 今月のセッション
SELECT COUNT(*)
FROM sessions
WHERE strftime('%Y-%m', created_at) = strftime('%Y-%m', 'now');

-- 特定の日付範囲
SELECT id, status, created_at
FROM sessions
WHERE created_at >= '2026-01-01'
  AND created_at < '2026-02-01';
```

### 3. グループ別の統計

```sql
-- グループごとのセッション数
SELECT
  group_id,
  COUNT(*) as session_count
FROM sessions
GROUP BY group_id
ORDER BY session_count DESC;

-- 特定のグループのセッション
SELECT id, status, created_at
FROM sessions
WHERE group_id = 'C48819908d9907fd29bf67958dc6de9f7'
ORDER BY created_at DESC;
```

### 4. JSON内のデータを分析

```sql
-- メンバー数の分布
SELECT
  json_array_length(data, '$.members') as member_count,
  COUNT(*) as sessions
FROM sessions
GROUP BY member_count
ORDER BY member_count;

-- 支払い件数の分布
SELECT
  json_array_length(data, '$.payments') as payment_count,
  COUNT(*) as sessions
FROM sessions
GROUP BY payment_count
ORDER BY payment_count;
```

### 5. データのエクスポート

```sql
-- CSV形式で出力
.mode csv
.output sessions_export.csv
SELECT id, group_id, status, created_at, updated_at FROM sessions;
.output stdout
.mode column

-- JSON形式で出力（1セッションのみ）
.output session_detail.json
SELECT data FROM sessions WHERE id = 'C48819908d9907fd29bf67958dc6de9f7';
.output stdout
```

---

## 🛠️ データの操作（注意！）

### ⚠️ 重要な注意事項

データベースを直接編集するのは**危険**です！
- データが壊れる可能性
- アプリケーションが動かなくなる可能性

**必ずバックアップを取ってから操作してください**:

```bash
# サーバー停止
pm2 stop all

# バックアップ
cp dist/data/database.db dist/data/database.db.backup

# 操作...

# 問題があれば復元
cp dist/data/database.db.backup dist/data/database.db

# 再起動
pm2 start all
```

### 安全な操作例

#### 古いセッションを削除（completed）

```sql
-- 確認（削除前）
SELECT COUNT(*) FROM sessions WHERE status = 'completed';

-- 削除
DELETE FROM sessions WHERE status = 'completed';

-- VACUUM（ディスク容量を解放）
VACUUM;
```

#### セッションのステータスを変更

```sql
-- 確認
SELECT id, status FROM sessions WHERE id = 'C48819908d9907fd29bf67958dc6de9f7';

-- 更新
UPDATE sessions
SET status = 'completed',
    updated_at = datetime('now')
WHERE id = 'C48819908d9907fd29bf67958dc6de9f7';
```

---

## 🔐 セキュリティとプライバシー

### データベースファイルの取り扱い

`database.db` には**個人情報**が含まれています：
- LINEグループID
- LINEユーザーID
- ユーザーの表示名

**注意点**:
1. ✅ 自分のPCで確認する → OK
2. ❌ GitHubにpushする → NG（.gitignoreで除外済み）
3. ❌ 公開のSlackチャンネルに貼る → NG
4. ⚠️ スクリーンショットを共有 → 個人情報をマスクする

---

## 📖 よくある質問

### Q1. データベースファイルはどこにある？

**A**:
```bash
# 本番環境（実際に動いているデータ）
~/tatekaezamurai-bot/server/dist/data/database.db

# 開発環境（srcディレクトリ）
~/tatekaezamurai-bot/server/src/data/database.db
```

### Q2. データベースが壊れた？

**A**: バックアップから復元してください
```bash
# 最新のバックアップを確認
ls -lt ~/tatekaezamurai-bot/server/dist/data/backups/

# 復元
pm2 stop all
rm dist/data/database.db
cp dist/data/backups/sessions_2026-01-22.json src/data/sessions.json
pm2 start all
# → 自動的にSQLiteに移行される
```

### Q3. データが増えすぎた？

**A**: VACUUMで最適化
```bash
pm2 stop all
sqlite3 dist/data/database.db "VACUUM;"
pm2 start all
```

### Q4. JSONの方が見やすいんだけど？

**A**: エクスポートできます
```bash
cd ~/tatekaezamurai-bot/server
npm run export-json
# → dist/data/backups/sessions_export_all_YYYY-MM-DD.json
```

### Q5. データベースをリセットしたい（全削除）

**A**:
```bash
pm2 stop all

# データベースを削除
rm ~/tatekaezamurai-bot/server/dist/data/database.db
rm ~/tatekaezamurai-bot/server/dist/data/database.db-*

# セッションJSONも削除（完全リセット）
rm ~/tatekaezamurai-bot/server/src/data/sessions.json

pm2 start all
# → 空のデータベースが作成される
```

---

## 🎓 学習リソース

### SQLiteを学ぶ

1. **公式ドキュメント**:
   - https://www.sqlite.org/docs.html
   - 特にJSON関数: https://www.sqlite.org/json1.html

2. **初心者向けチュートリアル**:
   - SQLBolt: https://sqlbolt.com/
   - W3Schools SQL: https://www.w3schools.com/sql/

3. **SQLite特有の機能**:
   - `.commands` で使えるコマンド一覧
   - `PRAGMA` でデータベース設定

---

## ✅ チェックリスト

データベースを確認する前に：

```
□ サーバーは動いている？（pm2 status）
□ バックアップは最新？（ls -lt dist/data/backups/）
□ 操作する場合、バックアップを取った？
□ 本番データを編集する場合、理解している？
```

---

## 🎯 まとめ

| 方法 | 難易度 | おすすめ度 | 用途 |
|------|-------|-----------|------|
| **npm run export-json:stats** | ⭐ | ⭐⭐⭐⭐⭐ | 統計を見る |
| **sqlite3コマンド** | ⭐⭐ | ⭐⭐⭐⭐ | サーバー上で確認 |
| **DB Browser for SQLite** | ⭐ | ⭐⭐⭐⭐⭐ | GUIで見る |
| **JSONエクスポート** | ⭐ | ⭐⭐⭐ | データ分析 |

**初心者は**: DB Browser for SQLite を使うのがおすすめ！

---

**データベースの中身がわかれば、より深くシステムを理解できます！** 🗄️
