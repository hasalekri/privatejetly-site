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

CREATE INDEX IF NOT EXISTS preorders_by_email_date ON preorders (email, created_at DESC);

CREATE TABLE IF NOT EXISTS preorder_status (
  reference TEXT PRIMARY KEY REFERENCES preorders(reference) ON DELETE CASCADE,
  status TEXT NOT NULL CHECK (status IN ('received', 'reviewing', 'closed'))
);

CREATE TABLE IF NOT EXISTS preorder_delivery (
  reference TEXT PRIMARY KEY REFERENCES preorders(reference) ON DELETE CASCADE,
  full_name TEXT NOT NULL,
  phone TEXT NOT NULL,
  country TEXT NOT NULL,
  city TEXT NOT NULL,
  address1 TEXT NOT NULL,
  address2 TEXT NOT NULL,
  region TEXT NOT NULL,
  postcode TEXT NOT NULL
);
