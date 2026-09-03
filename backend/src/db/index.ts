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
