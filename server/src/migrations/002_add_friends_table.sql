-- 友達情報テーブル
CREATE TABLE IF NOT EXISTS friends (
  user_id TEXT PRIMARY KEY,
  display_name TEXT NOT NULL,
  picture_url TEXT,
  status_message TEXT,
  followed_at TEXT NOT NULL,
  unfollowed_at TEXT,
  is_active INTEGER DEFAULT 1,
  created_at TEXT NOT NULL,
  updated_at TEXT NOT NULL
);

-- インデックス作成
CREATE INDEX IF NOT EXISTS idx_friends_followed_at ON friends(followed_at);
CREATE INDEX IF NOT EXISTS idx_friends_is_active ON friends(is_active);
CREATE INDEX IF NOT EXISTS idx_friends_created_at ON friends(created_at);

-- サンプルクエリ（コメント）
-- アクティブな友達一覧
-- SELECT * FROM friends WHERE is_active = 1 ORDER BY followed_at DESC;

-- 友達数
-- SELECT COUNT(*) FROM friends WHERE is_active = 1;

-- 今月の友達追加数
-- SELECT COUNT(*) FROM friends WHERE followed_at >= date('now', 'start of month');
