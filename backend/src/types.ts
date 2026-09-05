export interface StoreRow {
  id: number;
  name: string;
  owner_google_uid: string | null;
  owner_email: string | null;
  created_at: string;
}

export interface ProductRow {
  id: number;
  store_id: number;
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
  store_id: number;
  username: string | null;
  password_hash: string | null;
  google_uid: string | null;
  name: string;
  role: "admin" | "kasir";
  active: 0 | 1;
  can_view_all_transactions: 0 | 1;
  can_view_reports: 0 | 1;
  can_manage_products: 0 | 1;
  can_void_transactions: 0 | 1;
  created_at: string;
}

export interface TransactionRow {
  id: number;
  store_id: number;
  user_id: number;
  created_at: string;
  subtotal: number;
  discount_total: number;
  tax_total: number;
  service_charge_percent: number;
  service_charge_total: number;
  total: number;
  payment_method: "tunai" | "kartu" | "qris" | "hutang";
  cash_received: number | null;
  change_due: number | null;
  status: "completed" | "voided";
  voided_at: string | null;
  void_reason: string | null;
  table_number: string | null;
  order_type: "dine_in" | "takeaway" | "delivery" | null;
  customer_name: string | null;
  debt_paid_at: string | null;
}

export interface HeldCartRow {
  id: number;
  store_id: number;
  user_id: number;
  label: string;
  items_json: string;
  created_at: string;
}

export interface StoreSettingsRow {
  store_id: number;
  store_name: string;
  store_address: string;
  store_phone: string;
  receipt_footer: string;
  theme: string;
  default_tax_rate_percent: number;
  business_mode: "toko" | "warung" | "restoran";
  default_service_charge_percent: number;
  adsense_client_id: string;
  adsense_slot_footer: string;
  adsense_slot_reports: string;
  updated_at: string;
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
  note: string;
}
