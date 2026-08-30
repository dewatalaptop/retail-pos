import { db } from "./index";
import { hashPassword } from "../lib/auth";

const userCount = (db.prepare("SELECT COUNT(*) as c FROM users").get() as { c: number }).c;

if (userCount === 0) {
  db.prepare(
    "INSERT INTO users (username, password_hash, name, role) VALUES (?, ?, ?, ?)"
  ).run("admin", hashPassword("admin123"), "Admin Toko", "admin");
  db.prepare(
    "INSERT INTO users (username, password_hash, name, role) VALUES (?, ?, ?, ?)"
  ).run("kasir", hashPassword("kasir123"), "Kasir 1", "kasir");
  console.log("Seeded users: admin/admin123 (admin), kasir/kasir123 (kasir)");
} else {
  console.log("Users already exist, skipping user seed.");
}

const productCount = (db.prepare("SELECT COUNT(*) as c FROM products").get() as { c: number }).c;

if (productCount === 0) {
  const products: Array<[string, string, string, string, number, number, number]> = [
    ["SKU-001", "Kopi Hitam", "Minuman", "Kopi hitam panas/dingin", 12000, 50, 10],
    ["SKU-002", "Es Teh Manis", "Minuman", "Teh manis dingin", 8000, 50, 10],
    ["SKU-003", "Roti Bakar Coklat", "Makanan", "Roti bakar isi coklat", 15000, 20, 5],
    ["SKU-004", "Nasi Goreng", "Makanan", "Nasi goreng spesial", 22000, 15, 5],
    ["SKU-005", "Keripik Kentang", "Snack", "Keripik kentang kemasan", 10000, 40, 8],
    ["SKU-006", "Air Mineral 600ml", "Minuman", "Air mineral botol", 5000, 100, 20],
    ["SKU-007", "Mie Instan Goreng", "Makanan", "Mie instan siap saji", 9000, 3, 5],
  ];
  const insert = db.prepare(
    `INSERT INTO products (sku, name, category, description, price, stock, low_stock_threshold)
     VALUES (?, ?, ?, ?, ?, ?, ?)`
  );
  for (const p of products) insert.run(...p);
  console.log(`Seeded ${products.length} products (SKU-007 sengaja stok rendah untuk demo notifikasi).`);
} else {
  console.log("Products already exist, skipping product seed.");
}
