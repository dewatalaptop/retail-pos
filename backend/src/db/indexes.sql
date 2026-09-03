-- Kept separate from schema.sql: some of these reference columns that on an
-- *existing* data.db only exist after db/index.ts's migration step runs, so
-- this file is applied after that step, not as part of schema.sql itself.
CREATE INDEX IF NOT EXISTS idx_users_store ON users(store_id);
CREATE INDEX IF NOT EXISTS idx_products_store ON products(store_id);
CREATE INDEX IF NOT EXISTS idx_products_category ON products(store_id, category);
CREATE INDEX IF NOT EXISTS idx_transactions_store ON transactions(store_id, created_at);
CREATE INDEX IF NOT EXISTS idx_transactions_user ON transactions(user_id);
CREATE INDEX IF NOT EXISTS idx_transactions_status ON transactions(status);
CREATE INDEX IF NOT EXISTS idx_transaction_items_tx ON transaction_items(transaction_id);
CREATE INDEX IF NOT EXISTS idx_held_carts_store_user ON held_carts(store_id, user_id);
