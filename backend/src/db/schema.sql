CREATE TABLE IF NOT EXISTS stores (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  name TEXT NOT NULL DEFAULT 'Toko Baru',
  owner_google_uid TEXT UNIQUE,
  owner_email TEXT,
  created_at TEXT NOT NULL DEFAULT (datetime('now'))
);

CREATE TABLE IF NOT EXISTS users (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  store_id INTEGER NOT NULL REFERENCES stores(id),
  username TEXT UNIQUE,
  password_hash TEXT,
  google_uid TEXT UNIQUE,
  name TEXT NOT NULL,
  role TEXT NOT NULL CHECK (role IN ('admin', 'kasir')),
  active INTEGER NOT NULL DEFAULT 1,
  can_view_all_transactions INTEGER NOT NULL DEFAULT 0,
  can_view_reports INTEGER NOT NULL DEFAULT 0,
  can_manage_products INTEGER NOT NULL DEFAULT 0,
  can_void_transactions INTEGER NOT NULL DEFAULT 0,
  created_at TEXT NOT NULL DEFAULT (datetime('now')),
  -- An owner (role='admin') authenticates via google_uid and has no
  -- password; a cashier (role='kasir') authenticates via username/password
  -- set by their owner and has no google_uid. Exactly one of the two must be
  -- set, never both, never neither.
  CHECK ((google_uid IS NOT NULL) != (username IS NOT NULL))
);

CREATE TABLE IF NOT EXISTS products (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  store_id INTEGER NOT NULL REFERENCES stores(id),
  sku TEXT NOT NULL,
  name TEXT NOT NULL,
  category TEXT NOT NULL DEFAULT 'Umum',
  description TEXT NOT NULL DEFAULT '',
  price REAL NOT NULL,
  stock INTEGER NOT NULL DEFAULT 0,
  low_stock_threshold INTEGER NOT NULL DEFAULT 5,
  created_at TEXT NOT NULL DEFAULT (datetime('now')),
  updated_at TEXT NOT NULL DEFAULT (datetime('now')),
  UNIQUE (store_id, sku)
);

CREATE TABLE IF NOT EXISTS transactions (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  store_id INTEGER NOT NULL REFERENCES stores(id),
  user_id INTEGER NOT NULL REFERENCES users(id),
  created_at TEXT NOT NULL DEFAULT (datetime('now')),
  subtotal REAL NOT NULL,
  discount_total REAL NOT NULL DEFAULT 0,
  tax_total REAL NOT NULL DEFAULT 0,
  total REAL NOT NULL,
  payment_method TEXT NOT NULL CHECK (payment_method IN ('tunai', 'kartu', 'qris')),
  cash_received REAL,
  change_due REAL,
  status TEXT NOT NULL DEFAULT 'completed' CHECK (status IN ('completed', 'voided')),
  voided_at TEXT,
  void_reason TEXT
);

CREATE TABLE IF NOT EXISTS transaction_items (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  transaction_id INTEGER NOT NULL REFERENCES transactions(id),
  product_id INTEGER NOT NULL REFERENCES products(id),
  name_snapshot TEXT NOT NULL,
  price_snapshot REAL NOT NULL,
  qty INTEGER NOT NULL,
  discount_percent REAL NOT NULL DEFAULT 0,
  line_total REAL NOT NULL
);

CREATE TABLE IF NOT EXISTS held_carts (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  store_id INTEGER NOT NULL REFERENCES stores(id),
  user_id INTEGER NOT NULL REFERENCES users(id),
  label TEXT NOT NULL DEFAULT '',
  items_json TEXT NOT NULL,
  created_at TEXT NOT NULL DEFAULT (datetime('now'))
);

CREATE TABLE IF NOT EXISTS store_settings (
  store_id INTEGER PRIMARY KEY REFERENCES stores(id),
  store_name TEXT NOT NULL DEFAULT 'Retail POS',
  store_address TEXT NOT NULL DEFAULT '',
  store_phone TEXT NOT NULL DEFAULT '',
  receipt_footer TEXT NOT NULL DEFAULT 'Terima kasih telah berbelanja!',
  theme TEXT NOT NULL DEFAULT 'indigo',
  default_tax_rate_percent REAL NOT NULL DEFAULT 0,
  adsense_client_id TEXT NOT NULL DEFAULT '',
  adsense_slot_footer TEXT NOT NULL DEFAULT '',
  adsense_slot_reports TEXT NOT NULL DEFAULT '',
  updated_at TEXT NOT NULL DEFAULT (datetime('now'))
);
