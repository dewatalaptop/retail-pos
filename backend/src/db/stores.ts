import { db } from "./index";

/**
 * Creates a brand-new, empty store (no demo products — this is what an owner
 * gets when they sign in with Google for the first time) plus its
 * store_settings row in the same step, since every route that reads settings
 * assumes that row exists for any store_id it's given.
 */
export function createStore(name: string): number {
  const result = db.prepare("INSERT INTO stores (name) VALUES (?)").run(name);
  const storeId = Number(result.lastInsertRowid);
  db.prepare("INSERT INTO store_settings (store_id, store_name) VALUES (?, ?)").run(storeId, name);
  return storeId;
}
