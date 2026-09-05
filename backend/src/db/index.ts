import { DatabaseSync } from "node:sqlite";
import fs from "fs";
import path from "path";

const DB_PATH = process.env.DB_PATH || path.join(__dirname, "..", "..", "data.db");

// Built-in node:sqlite (Node 22+) — no native compilation (node-gyp/Python)
// needed, unlike better-sqlite3, so the app installs cleanly everywhere.
export const db = new DatabaseSync(DB_PATH);
db.exec("PRAGMA journal_mode = WAL");
db.exec("PRAGMA foreign_keys = ON");

const schema = fs.readFileSync(path.join(__dirname, "schema.sql"), "utf-8");
db.exec(schema);

// `CREATE TABLE IF NOT EXISTS` (above) only covers brand-new tables — an
// existing data.db from before a column was added needs it patched in by
// hand, since SQLite has no "ALTER TABLE ... ADD COLUMN IF NOT EXISTS" that
// works reliably across the SQLite versions node:sqlite has shipped. Keep
// this as a running log of such patches (each one a no-op once applied).
migrateAddColumnIfMissing("transactions", "status", "TEXT NOT NULL DEFAULT 'completed'");
migrateAddColumnIfMissing("transactions", "voided_at", "TEXT");
migrateAddColumnIfMissing("transactions", "void_reason", "TEXT");
migrateAddColumnIfMissing("store_settings", "theme", "TEXT NOT NULL DEFAULT 'indigo'");
migrateAddColumnIfMissing("store_settings", "default_tax_rate_percent", "REAL NOT NULL DEFAULT 0");
migrateAddColumnIfMissing("store_settings", "business_mode", "TEXT NOT NULL DEFAULT 'toko' CHECK (business_mode IN ('toko', 'warung', 'restoran'))");
migrateAddColumnIfMissing("store_settings", "default_service_charge_percent", "REAL NOT NULL DEFAULT 0");
migrateAddColumnIfMissing("transaction_items", "note", "TEXT NOT NULL DEFAULT ''");
// Adding 'hutang' to payment_method's allowed values means relaxing a
// column-level CHECK that's baked into the table's existing schema —
// SQLite has no ALTER TABLE for that, only a full rebuild (its own
// documented pattern for changing a CHECK constraint). Bundles in the rest
// of this feature's new transactions columns too, so it only rebuilds once
// rather than issuing several ADD COLUMNs before/after it in a confusing
// order. Safe against real production data (verified 2026-09-05: live
// retail-pos-demo had 0 existing transaction rows at migration time — a
// Storage backup was still taken first regardless, see memory
// ai-app-builder-default-deploy).
function migrateTransactionsPaymentMethodCheck(): void {
  const row = db
    .prepare("SELECT sql FROM sqlite_master WHERE type='table' AND name='transactions'")
    .get() as { sql: string } | undefined;
  if (!row || row.sql.includes("'hutang'")) return; // table doesn't exist yet, or already migrated
  db.exec("BEGIN");
  try {
    db.exec(`
      CREATE TABLE transactions_new (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        store_id INTEGER NOT NULL REFERENCES stores(id),
        user_id INTEGER NOT NULL REFERENCES users(id),
        created_at TEXT NOT NULL DEFAULT (datetime('now')),
        subtotal REAL NOT NULL,
        discount_total REAL NOT NULL DEFAULT 0,
        tax_total REAL NOT NULL DEFAULT 0,
        service_charge_percent REAL NOT NULL DEFAULT 0,
        service_charge_total REAL NOT NULL DEFAULT 0,
        total REAL NOT NULL,
        payment_method TEXT NOT NULL CHECK (payment_method IN ('tunai', 'kartu', 'qris', 'hutang')),
        cash_received REAL,
        change_due REAL,
        status TEXT NOT NULL DEFAULT 'completed' CHECK (status IN ('completed', 'voided')),
        voided_at TEXT,
        void_reason TEXT,
        table_number TEXT,
        order_type TEXT CHECK (order_type IS NULL OR order_type IN ('dine_in', 'takeaway', 'delivery')),
        customer_name TEXT,
        debt_paid_at TEXT
      )
    `);
    db.exec(`
      INSERT INTO transactions_new (id, store_id, user_id, created_at, subtotal, discount_total, tax_total, total, payment_method, cash_received, change_due, status, voided_at, void_reason)
      SELECT id, store_id, user_id, created_at, subtotal, discount_total, tax_total, total, payment_method, cash_received, change_due, status, voided_at, void_reason FROM transactions
    `);
    db.exec("DROP TABLE transactions");
    db.exec("ALTER TABLE transactions_new RENAME TO transactions");
    db.exec("COMMIT");
  } catch (err) {
    db.exec("ROLLBACK");
    throw err;
  }
}
migrateTransactionsPaymentMethodCheck();

function migrateAddColumnIfMissing(table: string, column: string, definition: string): void {
  const existing = db.prepare(`PRAGMA table_info(${table})`).all() as { name: string }[];
  if (existing.some((c) => c.name === column)) return;
  db.exec(`ALTER TABLE ${table} ADD COLUMN ${column} ${definition}`);
}

// Indexes are applied last, and from a separate file — some of them (e.g. on
// transactions.status) reference a column that only exists post-migration on
// an existing data.db, so they can't be part of schema.sql itself (see
// indexes.sql for the full reasoning).
const indexes = fs.readFileSync(path.join(__dirname, "indexes.sql"), "utf-8");
db.exec(indexes);
