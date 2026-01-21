-- 清算くん - 初期データベーススキーマ
-- SQLite用スキーマ定義

-- セッションテーブル
CREATE TABLE IF NOT EXISTS sessions (
  id TEXT PRIMARY KEY,              -- セッションID (UUID)
  group_id TEXT NOT NULL,           -- LINEグループID
  status TEXT NOT NULL              -- active/settled/completed
    CHECK(status IN ('active', 'settled', 'completed')),
  created_at TEXT NOT NULL,         -- ISO8601形式の日時
  updated_at TEXT NOT NULL,         -- ISO8601形式の日時
  data TEXT NOT NULL                -- JSON形式で全データ保存（柔軟性重視）
);

-- インデックス（検索パフォーマンス向上）
CREATE INDEX IF NOT EXISTS idx_sessions_group ON sessions(group_id);
CREATE INDEX IF NOT EXISTS idx_sessions_status ON sessions(status);
CREATE INDEX IF NOT EXISTS idx_sessions_created ON sessions(created_at);

-- 分析イベントテーブル（将来の拡張用）
CREATE TABLE IF NOT EXISTS analytics_events (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  event_type TEXT NOT NULL,         -- payment/settle/start/end/join
  group_id TEXT,
  user_id TEXT,
  session_id TEXT,
  amount INTEGER,                   -- 金額（該当する場合）
  label TEXT,                       -- 項目名（該当する場合）
  created_at TEXT NOT NULL,         -- ISO8601形式の日時
  metadata TEXT                     -- JSON形式で追加情報
);

-- 分析用インデックス
CREATE INDEX IF NOT EXISTS idx_analytics_type ON analytics_events(event_type);
CREATE INDEX IF NOT EXISTS idx_analytics_created ON analytics_events(created_at);
CREATE INDEX IF NOT EXISTS idx_analytics_user ON analytics_events(user_id);
CREATE INDEX IF NOT EXISTS idx_analytics_group ON analytics_events(group_id);
