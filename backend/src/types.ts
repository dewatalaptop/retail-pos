export interface ProductRow {
  id: number;
  sku: string;
  name: string;
  category: string;
  description: string;
  price: number;
  stock: number;
  low_stock_threshold: number;
  created_at: string;
  updated_at: string;
}

export interface UserRow {
  id: number;
  username: string;
  password_hash: string;
  name: string;
  role: "admin" | "kasir";
  created_at: string;
}

export interface TransactionRow {
  id: number;
  user_id: number;
  created_at: string;
  subtotal: number;
  discount_total: number;
  tax_total: number;
  total: number;
  payment_method: "tunai" | "kartu" | "qris";
  cash_received: number | null;
  change_due: number | null;
}

export interface TransactionItemRow {
  id: number;
  transaction_id: number;
  product_id: number;
  name_snapshot: string;
  price_snapshot: number;
  qty: number;
  discount_percent: number;
  line_total: number;
}
