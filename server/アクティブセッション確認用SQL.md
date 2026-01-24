# 🔍 アクティブセッション確認用SQL

Raspberry Piで以下のコマンドを実行してください：

## 方法1: 簡易確認

```bash
cd ~/tatekaezamurai-bot/server

sqlite3 dist/data/database.db << 'EOF'
.headers on
.mode column

-- アクティブなセッションの基本情報
SELECT
  group_id,
  created_at,
  updated_at,
  substr(data, 1, 200) as data_preview
FROM sessions
WHERE status = 'active';
EOF
```

## 方法2: 詳細確認（JSON解析）

```bash
sqlite3 dist/data/database.db << 'EOF'
.headers on
.mode column

-- アクティブなセッションの詳細情報
SELECT
  group_id,
  status,
  datetime(created_at) as created,
  datetime(updated_at) as updated,
  json_extract(data, '$.groupName') as group_name,
  json_extract(data, '$.createdBy.displayName') as created_by,
  json_array_length(json_extract(data, '$.members')) as member_count,
  json_array_length(json_extract(data, '$.payments')) as payment_count
FROM sessions
WHERE status = 'active';
EOF
```

## 方法3: グループIDとメンバー一覧

```bash
sqlite3 dist/data/database.db << 'EOF'
.headers on
.mode line

SELECT
  '=== アクティブなセッション ===' as info;

SELECT
  group_id,
  created_at,
  updated_at
FROM sessions
WHERE status = 'active';

-- メンバー情報を取得
SELECT
  json_extract(value, '$.displayName') as member_name,
  json_extract(value, '$.userId') as user_id
FROM sessions, json_each(json_extract(data, '$.members'))
WHERE status = 'active';
EOF
```

---

## セッションを終了する方法

### グループIDが分かったら：

#### 方法A: LINEから終了（推奨）

そのグループに参加して、LINEで以下を送信：

```
終了
```

#### 方法B: データベースから直接終了

**注意**: これは手動でDBを操作する方法です。バックアップを取ってから実行してください。

```bash
# バックアップ
cp dist/data/database.db dist/data/database.db.backup

# セッションを終了状態に変更
sqlite3 dist/data/database.db << 'EOF'
UPDATE sessions
SET
  status = 'completed',
  updated_at = datetime('now')
WHERE status = 'active';

-- 確認
SELECT status, COUNT(*) FROM sessions GROUP BY status;
EOF
```

実行後の結果：
```
active|0
completed|9
```

#### 方法C: スクリプトを作成（安全）

サーバー側にエンドポイントを追加して、管理者用のセッション終了機能を作る方法もあります。

---

## まず実行してほしいコマンド

```bash
cd ~/tatekaezamurai-bot/server
sqlite3 dist/data/database.db "SELECT group_id, created_at, updated_at FROM sessions WHERE status = 'active';"
```

これでグループIDと日時が分かります。
