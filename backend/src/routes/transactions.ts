import { Router } from "express";
import { z } from "zod";
import { db } from "../db";
import { requireAuth, requirePermission } from "../middleware/auth";
import { computeCartTotals, computeChange, computeLineTotal } from "../lib/pricing";
import { aggregateQuantities, checkStockAvailability, deductStock } from "../lib/stock";
import { ProductRow, TransactionItemRow, TransactionRow } from "../types";
import { notifyDbChanged } from "../db/persistenceHook";
import { asyncHandler } from "../lib/asyncHandler";

export const transactionsRouter = Router();

transactionsRouter.use(requireAuth);

const saleSchema = z
  .object({
    items: z
      .array(
        z.object({
          productId: z.number().int().positive(),
          qty: z.number().int().positive(),
          discountPercent: z.number().min(0).max(100).default(0),
          note: z.string().default(""),
        })
      )
      .min(1),
    paymentMethod: z.enum(["tunai", "kartu", "qris", "hutang"]),
    cashReceived: z.number().nonnegative().optional(),
    taxRatePercent: z.number().min(0).max(100).default(0),
    // Restoran mode — all optional so toko/warung mode requests are
    // unaffected; the frontend only sends these when business_mode calls for
    // them.
    serviceChargePercent: z.number().min(0).max(100).default(0),
    tableNumber: z.string().trim().max(50).optional(),
    orderType: z.enum(["dine_in", "takeaway", "delivery"]).optional(),
    // Warung mode credit sale — required by the check below when
    // paymentMethod is 'hutang'.
    customerName: z.string().trim().max(100).optional(),
  })
  .refine((data) => data.paymentMethod !== "hutang" || !!data.customerName, {
    message: "Nama pelanggan wajib diisi untuk transaksi hutang",
    path: ["customerName"],
  });

transactionsRouter.post(
  "/",
  asyncHandler(async (req, res) => {
    const parsed = saleSchema.safeParse(req.body);
    if (!parsed.success) {
      return res.status(400).json({ error: parsed.error.issues[0]?.message ?? "Data tidak valid" });
    }
    const {
      items,
      paymentMethod,
      cashReceived,
      taxRatePercent,
      serviceChargePercent,
      tableNumber,
      orderType,
      customerName,
    } = parsed.data;
    const storeId = req.user!.storeId;

    const products = items.map((item) => {
      // Scoped by store_id — without this, a productId belonging to a
      // different store would be readable/sellable cross-tenant.
      const product = db
        .prepare("SELECT * FROM products WHERE id = ? AND store_id = ?")
        .get(item.productId, storeId) as unknown as ProductRow | undefined;
      if (!product) throw Object.assign(new Error(`Produk #${item.productId} tidak ditemukan`), { status: 404 });
      return { item, product };
    });

    // A cart can list the same product on more than one line (e.g. different
    // discounts per line), so shortfalls must be checked against the combined
    // requested quantity per product, not each line independently — otherwise
    // two lines each individually "within stock" could together oversell it.
    const requestedByProduct = aggregateQuantities(
      products.map(({ item }) => ({ productId: item.productId, qty: item.qty }))
    );
    const shortfalls = checkStockAvailability(
      [...requestedByProduct.entries()].map(([productId, requestedQty]) => {
        const product = products.find((p) => p.product.id === productId)!.product;
        return { productId, name: product.name, currentStock: product.stock, requestedQty };
      })
    );
    if (shortfalls.length > 0) {
      return res.status(409).json({ error: "Stok tidak mencukupi", shortfalls });
    }

    const cartItems = products.map(({ item, product }) => ({
      price: product.price,
      qty: item.qty,
      discountPercent: item.discountPercent,
    }));
    const totals = computeCartTotals(cartItems, taxRatePercent, serviceChargePercent);

    let changeDue: number | null = null;
    if (paymentMethod === "tunai") {
      if (cashReceived === undefined) {
        return res.status(400).json({ error: "cashReceived wajib diisi untuk pembayaran tunai" });
      }
      changeDue = computeChange(totals.total, cashReceived).changeDue;
    }

    // node:sqlite's DatabaseSync has no built-in `.transaction()` helper (unlike
    // better-sqlite3), so the atomic all-or-nothing sale is wrapped manually.
    db.exec("BEGIN");
    try {
      const txResult = db
        .prepare(
          `INSERT INTO transactions (store_id, user_id, subtotal, discount_total, tax_total, service_charge_percent, service_charge_total, total, payment_method, cash_received, change_due, table_number, order_type, customer_name)
           VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`
        )
        .run(
          storeId,
          req.user!.userId,
          totals.subtotal,
          totals.discountTotal,
          totals.taxTotal,
          serviceChargePercent,
          totals.serviceChargeTotal,
          totals.total,
          paymentMethod,
          cashReceived ?? null,
          changeDue,
          tableNumber ?? null,
          orderType ?? null,
          customerName ?? null
        );
      const transactionId = txResult.lastInsertRowid;

      // Tracks stock per product as it's deducted across lines, so a product
      // appearing on multiple lines in the same sale is deducted cumulatively
      // instead of each line overwriting from the same stale starting stock.
      const runningStock = new Map<number, number>();
      for (const { item, product } of products) {
        const lineTotal = computeLineTotal({
          price: product.price,
          qty: item.qty,
          discountPercent: item.discountPercent,
        });
        db.prepare(
          `INSERT INTO transaction_items (transaction_id, product_id, name_snapshot, price_snapshot, qty, discount_percent, line_total, note)
           VALUES (?, ?, ?, ?, ?, ?, ?, ?)`
        ).run(transactionId, product.id, product.name, product.price, item.qty, item.discountPercent, lineTotal, item.note);

        const stockBefore = runningStock.get(product.id) ?? product.stock;
        const newStock = deductStock(stockBefore, item.qty);
        runningStock.set(product.id, newStock);
        db.prepare("UPDATE products SET stock = ?, updated_at = datetime('now') WHERE id = ?").run(
          newStock,
          product.id
        );
      }

      db.exec("COMMIT");
      await notifyDbChanged();
      res.status(201).json({ transactionId, ...totals, changeDue });
    } catch (err: any) {
      db.exec("ROLLBACK");
      res.status(err.status ?? 500).json({ error: err.message ?? "Gagal menyimpan transaksi" });
    }
  })
);

// Warung mode: customer credit tracking. Registered before GET "/:id" so a
// literal "debts" segment is never mistaken for a transaction id (Express
// wouldn't actually confuse a 2-segment path with a 1-segment `:id` pattern
// either way, but keeping static routes ahead of dynamic ones is the
// conventional, least-surprising order).
transactionsRouter.get("/debts/unpaid", (req, res) => {
  let sql = "SELECT * FROM transactions WHERE store_id = ? AND payment_method = 'hutang' AND debt_paid_at IS NULL AND status = 'completed'";
  const params: (string | number)[] = [req.user!.storeId];
  if (req.user!.role === "kasir" && !req.user!.permissions.canViewAllTransactions) {
    sql += " AND user_id = ?";
    params.push(req.user!.userId);
  }
  sql += " ORDER BY created_at ASC";
  const transactions = db.prepare(sql).all(...params) as unknown as TransactionRow[];
  res.json({ transactions });
});

transactionsRouter.post(
  "/:id/mark-paid",
  asyncHandler(async (req, res) => {
    const transaction = db
      .prepare("SELECT * FROM transactions WHERE id = ? AND store_id = ?")
      .get(req.params.id, req.user!.storeId) as unknown as TransactionRow | undefined;
    if (!transaction) return res.status(404).json({ error: "Transaksi tidak ditemukan" });
    if (transaction.payment_method !== "hutang") {
      return res.status(409).json({ error: "Transaksi ini bukan transaksi hutang" });
    }
    if (transaction.debt_paid_at) {
      return res.status(409).json({ error: "Hutang ini sudah ditandai lunas sebelumnya" });
    }
    db.prepare("UPDATE transactions SET debt_paid_at = datetime('now') WHERE id = ?").run(req.params.id);
    await notifyDbChanged();
    const updated = db.prepare("SELECT * FROM transactions WHERE id = ?").get(req.params.id);
    res.json({ transaction: updated });
  })
);

transactionsRouter.get("/", (req, res) => {
  const from = String(req.query.from ?? "");
  const to = String(req.query.to ?? "");

  let sql = "SELECT * FROM transactions WHERE store_id = ?";
  const params: (string | number)[] = [req.user!.storeId];

  // A kasir only sees their own sales unless their owner has granted them
  // canViewAllTransactions; an admin (owner) always sees everyone's.
  if (req.user!.role === "kasir" && !req.user!.permissions.canViewAllTransactions) {
    sql += " AND user_id = ?";
    params.push(req.user!.userId);
  }
  if (from) {
    sql += " AND created_at >= ?";
    params.push(from);
  }
  if (to) {
    sql += " AND created_at <= ?";
    params.push(to);
  }
  sql += " ORDER BY created_at DESC LIMIT 200";

  const transactions = db.prepare(sql).all(...params) as unknown as TransactionRow[];
  res.json({ transactions });
});

transactionsRouter.get("/:id", (req, res) => {
  const transaction = db
    .prepare("SELECT * FROM transactions WHERE id = ? AND store_id = ?")
    .get(req.params.id, req.user!.storeId) as unknown as TransactionRow | undefined;
  if (!transaction) return res.status(404).json({ error: "Transaksi tidak ditemukan" });
  if (
    req.user!.role === "kasir" &&
    !req.user!.permissions.canViewAllTransactions &&
    transaction.user_id !== req.user!.userId
  ) {
    return res.status(403).json({ error: "Tidak punya akses ke transaksi ini" });
  }

  const items = db
    .prepare("SELECT * FROM transaction_items WHERE transaction_id = ?")
    .all(req.params.id) as unknown as TransactionItemRow[];

  res.json({ transaction, items });
});

const voidSchema = z.object({ reason: z.string().default("") });

// Cancels a completed sale and restores the stock it deducted. Voiding never
// deletes the row — it stays visible in history/reports with a 'voided'
// status so the audit trail is honest, it's just excluded from revenue
// totals (see reports.ts). Gated behind canVoidTransactions (admin always
// passes) rather than hard-coded to admin, so an owner can delegate it.
transactionsRouter.post(
  "/:id/void",
  requirePermission("canVoidTransactions"),
  asyncHandler(async (req, res) => {
    const parsed = voidSchema.safeParse(req.body ?? {});
    const reason = parsed.success ? parsed.data.reason : "";
    const storeId = req.user!.storeId;

    const transaction = db
      .prepare("SELECT * FROM transactions WHERE id = ? AND store_id = ?")
      .get(req.params.id, storeId) as unknown as TransactionRow | undefined;
    if (!transaction) return res.status(404).json({ error: "Transaksi tidak ditemukan" });
    if (transaction.status === "voided") {
      return res.status(409).json({ error: "Transaksi ini sudah dibatalkan sebelumnya" });
    }

    const items = db
      .prepare("SELECT * FROM transaction_items WHERE transaction_id = ?")
      .all(req.params.id) as unknown as TransactionItemRow[];

    db.exec("BEGIN");
    try {
      for (const item of items) {
        db.prepare("UPDATE products SET stock = stock + ?, updated_at = datetime('now') WHERE id = ?").run(
          item.qty,
          item.product_id
        );
      }
      db.prepare(
        "UPDATE transactions SET status = 'voided', voided_at = datetime('now'), void_reason = ? WHERE id = ?"
      ).run(reason, req.params.id);
      db.exec("COMMIT");
    } catch (err) {
      db.exec("ROLLBACK");
      throw err;
    }

    await notifyDbChanged();
    const updated = db.prepare("SELECT * FROM transactions WHERE id = ?").get(req.params.id);
    res.json({ transaction: updated });
  })
);
