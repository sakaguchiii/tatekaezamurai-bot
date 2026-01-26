# 📊 SQLite - 表形式表示コマンド集

**作成日**: 2026年1月25日

---

## 🎯 基本的な表形式表示

### 最も簡単な方法

```bash
cd ~/tatekaezamurai-bot/server
sqlite3 dist/data/database.db

# SQLiteプロンプトで以下を実行
.headers on
.mode column

# クエリを実行
SELECT * FROM sessions;
```

**出力イメージ**:
```
group_id                           status     created_at
---------------------------------  ---------  -------------------
C47ef98c5919d7d136435d939f9fd7c99  completed  2026-01-23 15:30:00
C8a91cc91e3297d1d59a52b0d75e8c10b  completed  2026-01-22 10:00:00
```

---

## 📋 表示モード一覧

### 1. column モード（推奨）⭐⭐⭐⭐⭐

**きれいに整列された列形式**

```sql
.headers on
.mode column

SELECT group_id, status, created_at FROM sessions LIMIT 3;
```

**出力**:
```
group_id                           status     created_at
---------------------------------  ---------  -------------------
C47ef98c5919d7d136435d939f9fd7c99  completed  2026-01-23 15:30:00
C8a91cc91e3297d1d59a52b0d75e8c10b  completed  2026-01-22 10:00:00
Cf863a5913db7717fea53f686a0b84f73  completed  2026-01-18 03:58:33
```

**列幅を指定**:
```sql
.width 35 15 20
```

---

### 2. table モード（最もきれい）⭐⭐⭐⭐⭐

**罫線付きの表形式**

```sql
.headers on
.mode table

SELECT group_id, status, created_at FROM sessions LIMIT 3;
```

**出力**:
```
+-----------------------------------+-----------+---------------------+
| group_id                          | status    | created_at          |
+-----------------------------------+-----------+---------------------+
| C47ef98c5919d7d136435d939f9fd7c99 | completed | 2026-01-23 15:30:00 |
| C8a91cc91e3297d1d59a52b0d75e8c10b | completed | 2026-01-22 10:00:00 |
| Cf863a5913db7717fea53f686a0b84f73 | completed | 2026-01-18 03:58:33 |
+-----------------------------------+-----------+---------------------+
```

---

### 3. box モード（Unicode罫線）⭐⭐⭐⭐

**Unicode罫線を使った美しい表**

```sql
.headers on
.mode box

SELECT group_id, status, created_at FROM sessions LIMIT 3;
```

**出力**:
```
┌───────────────────────────────────┬───────────┬─────────────────────┐
│ group_id                          │ status    │ created_at          │
├───────────────────────────────────┼───────────┼─────────────────────┤
│ C47ef98c5919d7d136435d939f9fd7c99 │ completed │ 2026-01-23 15:30:00 │
│ C8a91cc91e3297d1d59a52b0d75e8c10b │ completed │ 2026-01-22 10:00:00 │
│ Cf863a5913db7717fea53f686a0b84f73 │ completed │ 2026-01-18 03:58:33 │
└───────────────────────────────────┴───────────┴─────────────────────┘
```

---

### 4. markdown モード（GitHub/Markdown用）⭐⭐⭐

**Markdownの表形式**

```sql
.headers on
.mode markdown

SELECT group_id, status, created_at FROM sessions LIMIT 3;
```

**出力**:
```
| group_id                          | status    | created_at          |
|-----------------------------------|-----------|---------------------|
| C47ef98c5919d7d136435d939f9fd7c99 | completed | 2026-01-23 15:30:00 |
| C8a91cc91e3297d1d59a52b0d75e8c10b | completed | 2026-01-22 10:00:00 |
| Cf863a5913db7717fea53f686a0b84f73 | completed | 2026-01-18 03:58:33 |
```

---

### 5. line モード（詳細表示）⭐⭐⭐

**1レコードを複数行で表示**

```sql
.headers on
.mode line

SELECT group_id, status, created_at FROM sessions LIMIT 2;
```

**出力**:
```
     group_id = C47ef98c5919d7d136435d939f9fd7c99
       status = completed
   created_at = 2026-01-23 15:30:00

     group_id = C8a91cc91e3297d1d59a52b0d75e8c10b
       status = completed
   created_at = 2026-01-22 10:00:00
```

**長いJSONデータを見る時に便利**

---

## 🎨 実践例

### 例1: セッション一覧を見やすく表示

```sql
.headers on
.mode table

SELECT
  substr(group_id, 1, 10) || '...' as group_id,
  json_extract(data, '$.groupName') as group_name,
  json_extract(data, '$.createdBy.displayName') as created_by,
  json_array_length(json_extract(data, '$.members')) as members,
  status,
  substr(created_at, 1, 10) as date
FROM sessions
ORDER BY created_at DESC
LIMIT 10;
```

**出力**:
```
+---------------+------------+-------------+---------+-----------+------------+
| group_id      | group_name | created_by  | members | status    | date       |
+---------------+------------+-------------+---------+-----------+------------+
| C47ef98c5...  | 飲み会     | つばさ      | 3       | completed | 2026-01-23 |
| C8a91cc91...  | (名前なし) | つばさ      | 2       | completed | 2026-01-22 |
| Cf863a591...  | (名前なし) | つばさ      | 1       | completed | 2026-01-18 |
+---------------+------------+-------------+---------+-----------+------------+
```

---

### 例2: ステータス別の集計

```sql
.headers on
.mode box

SELECT
  status,
  COUNT(*) as count,
  MIN(created_at) as first_session,
  MAX(created_at) as last_session
FROM sessions
GROUP BY status;
```

**出力**:
```
┌───────────┬───────┬─────────────────────┬─────────────────────┐
│  status   │ count │   first_session     │   last_session      │
├───────────┼───────┼─────────────────────┼─────────────────────┤
│ active    │ 1     │ 2026-01-18 03:58:33 │ 2026-01-18 03:58:33 │
│ completed │ 8     │ 2026-01-19 10:00:00 │ 2026-01-23 15:30:00 │
└───────────┴───────┴─────────────────────┴─────────────────────┘
```

---

### 例3: JSON内のメンバー情報を展開

```sql
.headers on
.mode column
.width 35 20 15

SELECT
  group_id,
  json_extract(value, '$.displayName') as member_name,
  json_extract(value, '$.userId') as user_id
FROM sessions, json_each(json_extract(data, '$.members'))
WHERE status = 'completed'
LIMIT 10;
```

---

## 🚀 ワンライナー（コマンドライン）

**SQLiteを起動せずに、コマンドラインから直接実行**

### 基本形

```bash
cd ~/tatekaezamurai-bot/server

# columnモード
sqlite3 -header -column dist/data/database.db "SELECT * FROM sessions;"

# tableモード
sqlite3 -header -table dist/data/database.db "SELECT * FROM sessions;"

# boxモード
sqlite3 -header -box dist/data/database.db "SELECT * FROM sessions;"
```

---

### ヒアドキュメントを使った複数コマンド

```bash
sqlite3 dist/data/database.db << 'EOF'
.headers on
.mode table

SELECT
  substr(group_id, 1, 10) || '...' as group_id,
  status,
  json_extract(data, '$.groupName') as group_name,
  json_array_length(json_extract(data, '$.members')) as members
FROM sessions
ORDER BY created_at DESC
LIMIT 5;
EOF
```

---

## 📊 カラム幅の調整

### 自動調整（デフォルト）

```sql
.mode column
SELECT * FROM sessions;
```

### 手動指定

```sql
.mode column
.width 35 15 20 10

SELECT group_id, status, created_at, updated_at FROM sessions;
```

### 負の値で右揃え

```sql
.width 35 -10 20

# 2列目（数値など）が右揃えになる
```

---

## 🎯 推奨設定（コピペ用）

### パターンA: 通常の確認用

```sql
.headers on
.mode table
```

### パターンB: 詳細確認用

```sql
.headers on
.mode line
```

### パターンC: データエクスポート用

```sql
.headers on
.mode csv
.output result.csv
SELECT * FROM sessions;
.output stdout
```

---

## 💡 便利なエイリアス

**~/.bashrc や ~/.zshrc に追加**:

```bash
# SQLite表形式クエリ
alias sq='sqlite3 -header -table ~/tatekaezamurai-bot/server/dist/data/database.db'

# 使い方
sq "SELECT * FROM sessions LIMIT 5;"
```

---

## 📝 クイックリファレンス

| モード | コマンド | 特徴 | 推奨度 |
|--------|---------|------|--------|
| **table** | `.mode table` | 罫線付き、きれい | ⭐⭐⭐⭐⭐ |
| **box** | `.mode box` | Unicode罫線、美しい | ⭐⭐⭐⭐ |
| **column** | `.mode column` | シンプル、高速 | ⭐⭐⭐⭐⭐ |
| **markdown** | `.mode markdown` | Markdown表 | ⭐⭐⭐ |
| **line** | `.mode line` | 詳細表示 | ⭐⭐⭐ |
| **csv** | `.mode csv` | エクスポート用 | ⭐⭐⭐⭐ |
| **json** | `.mode json` | JSON出力 | ⭐⭐⭐ |

---

## 🎯 今すぐ使えるコマンド

**Raspberry Piで以下を実行してください**:

```bash
cd ~/tatekaezamurai-bot/server

sqlite3 dist/data/database.db << 'EOF'
.headers on
.mode table

-- セッション一覧
SELECT
  substr(group_id, 1, 12) || '...' as group_id,
  CASE
    WHEN json_extract(data, '$.groupName') = '' THEN '(名前なし)'
    ELSE json_extract(data, '$.groupName')
  END as group_name,
  json_extract(data, '$.createdBy.displayName') as created_by,
  json_array_length(json_extract(data, '$.members')) as members,
  json_array_length(json_extract(data, '$.payments')) as payments,
  status,
  substr(created_at, 1, 10) as date
FROM sessions
ORDER BY created_at DESC;
EOF
```

これで、すべてのセッションがきれいな表形式で表示されます！
