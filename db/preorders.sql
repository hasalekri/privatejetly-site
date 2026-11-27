CREATE TABLE IF NOT EXISTS sessions (
  digest TEXT PRIMARY KEY,
  email TEXT NOT NULL,
  expires INTEGER NOT NULL
);

CREATE TABLE IF NOT EXISTS preorders (
  reference TEXT PRIMARY KEY,
  email TEXT NOT NULL,
  request_key TEXT NOT NULL,
  items TEXT NOT NULL,
  total_bhd INTEGER NOT NULL,
  display_currency TEXT NOT NULL,
  created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
  UNIQUE (email, request_key)
);
