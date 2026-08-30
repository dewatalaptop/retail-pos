import { Router } from "express";
import { z } from "zod";
import { db } from "../db";
import { requireAuth, requireRole } from "../middleware/auth";
import { ProductRow } from "../types";
import { isLowStock } from "../lib/stock";

export const productsRouter = Router();

productsRouter.use(requireAuth);

productsRouter.get("/", (req, res) => {
  const q = String(req.query.q ?? "").trim();
  const category = String(req.query.category ?? "").trim();

  let sql = "SELECT * FROM products WHERE 1=1";
  const params: (string | number)[] = [];
  if (q) {
    sql += " AND (name LIKE ? OR sku LIKE ?)";
    params.push(`%${q}%`, `%${q}%`);
  }
  if (category) {
    sql += " AND category = ?";
    params.push(category);
  }
  sql += " ORDER BY name ASC";

  const products = db.prepare(sql).all(...params) as unknown as ProductRow[];
  res.json({
    products: products.map((p) => ({ ...p, lowStock: isLowStock(p.stock, p.low_stock_threshold) })),
  });
});

productsRouter.get("/low-stock", requireRole("admin"), (_req, res) => {
  const products = db.prepare("SELECT * FROM products").all() as unknown as ProductRow[];
  const lowStock = products.filter((p) => isLowStock(p.stock, p.low_stock_threshold));
  res.json({ products: lowStock });
});

productsRouter.get("/categories", (_req, res) => {
  const rows = db.prepare("SELECT DISTINCT category FROM products ORDER BY category").all() as {
    category: string;
  }[];
  res.json({ categories: rows.map((r) => r.category) });
});

const productSchema = z.object({
  sku: z.string().min(1),
  name: z.string().min(1),
  category: z.string().min(1).default("Umum"),
  description: z.string().default(""),
  price: z.number().nonnegative(),
  stock: z.number().int().nonnegative(),
  lowStockThreshold: z.number().int().nonnegative().default(5),
});

productsRouter.post("/", requireRole("admin"), (req, res) => {
  const parsed = productSchema.safeParse(req.body);
  if (!parsed.success) {
    return res.status(400).json({ error: parsed.error.issues[0]?.message ?? "Data tidak valid" });
  }
  const p = parsed.data;
  try {
    const result = db
      .prepare(
        `INSERT INTO products (sku, name, category, description, price, stock, low_stock_threshold)
         VALUES (?, ?, ?, ?, ?, ?, ?)`
      )
      .run(p.sku, p.name, p.category, p.description, p.price, p.stock, p.lowStockThreshold);
    const created = db.prepare("SELECT * FROM products WHERE id = ?").get(result.lastInsertRowid);
    res.status(201).json({ product: created });
  } catch (err: any) {
    if (String(err.message).includes("UNIQUE")) {
      return res.status(409).json({ error: "SKU sudah dipakai" });
    }
    throw err;
  }
});

productsRouter.put("/:id", requireRole("admin"), (req, res) => {
  const parsed = productSchema.partial().safeParse(req.body);
  if (!parsed.success) {
    return res.status(400).json({ error: parsed.error.issues[0]?.message ?? "Data tidak valid" });
  }
  const existing = db.prepare("SELECT * FROM products WHERE id = ?").get(req.params.id) as unknown as
    | ProductRow
    | undefined;
  if (!existing) return res.status(404).json({ error: "Produk tidak ditemukan" });

  const patch = parsed.data;
  const merged = {
    sku: patch.sku ?? existing.sku,
    name: patch.name ?? existing.name,
    category: patch.category ?? existing.category,
    description: patch.description ?? existing.description,
    price: patch.price ?? existing.price,
    stock: patch.stock ?? existing.stock,
    lowStockThreshold: patch.lowStockThreshold ?? existing.low_stock_threshold,
  };
  db.prepare(
    `UPDATE products SET sku=?, name=?, category=?, description=?, price=?, stock=?, low_stock_threshold=?, updated_at=datetime('now')
     WHERE id=?`
  ).run(
    merged.sku,
    merged.name,
    merged.category,
    merged.description,
    merged.price,
    merged.stock,
    merged.lowStockThreshold,
    req.params.id
  );

  const updated = db.prepare("SELECT * FROM products WHERE id = ?").get(req.params.id);
  res.json({ product: updated });
});

productsRouter.delete("/:id", requireRole("admin"), (req, res) => {
  db.prepare("DELETE FROM products WHERE id = ?").run(req.params.id);
  res.status(204).end();
});
