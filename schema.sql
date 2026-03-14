-- XHS OAuth tokens
CREATE TABLE IF NOT EXISTS oauth_tokens (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  user_id TEXT NOT NULL UNIQUE,
  access_token TEXT NOT NULL,
  refresh_token TEXT,
  token_type TEXT DEFAULT 'bearer',
  expires_at INTEGER NOT NULL,
  scope TEXT,
  created_at TEXT DEFAULT (datetime('now')),
  updated_at TEXT DEFAULT (datetime('now'))
);

CREATE INDEX IF NOT EXISTS idx_tokens_user_id ON oauth_tokens(user_id);
CREATE INDEX IF NOT EXISTS idx_tokens_expires ON oauth_tokens(expires_at);
