import { Router } from "express";
import { db } from "../db";
import { requireAuth, requirePermission } from "../middleware/auth";

export const reportsRouter = Router();

reportsRouter.use(requireAuth, requirePermission("canViewReports"));

reportsRouter.get("/summary", (req, res) => {
  const from = String(req.query.from ?? "1970-01-01");
  const to = String(req.query.to ?? "9999-12-31");
  const storeId = req.user!.storeId;

  // Voided sales stay in the table for the audit trail (see transactions.ts)
  // but must not count toward revenue or best-seller figures.
  const totals = db
    .prepare(
      `SELECT COUNT(*) as transactionCount, COALESCE(SUM(total), 0) as revenue
       FROM transactions WHERE store_id = ? AND status = 'completed' AND created_at >= ? AND created_at <= ?`
    )
    .get(storeId, from, to) as { transactionCount: number; revenue: number };

  const voidedCount = (
    db
      .prepare(
        `SELECT COUNT(*) as c FROM transactions WHERE store_id = ? AND status = 'voided' AND created_at >= ? AND created_at <= ?`
      )
      .get(storeId, from, to) as { c: number }
  ).c;

  const byDay = db
    .prepare(
      `SELECT date(created_at) as day, COALESCE(SUM(total), 0) as revenue, COUNT(*) as transactionCount
       FROM transactions WHERE store_id = ? AND status = 'completed' AND created_at >= ? AND created_at <= ?
       GROUP BY day ORDER BY day ASC`
    )
    .all(storeId, from, to);

  const byMonth = db
    .prepare(
      `SELECT strftime('%Y-%m', created_at) as month, COALESCE(SUM(total), 0) as revenue, COUNT(*) as transactionCount
       FROM transactions WHERE store_id = ? AND status = 'completed' AND created_at >= ? AND created_at <= ?
       GROUP BY month ORDER BY month ASC`
    )
    .all(storeId, from, to);

  const topProducts = db
    .prepare(
      `SELECT ti.product_id as productId, ti.name_snapshot as name,
              SUM(ti.qty) as qtySold, SUM(ti.line_total) as revenue
       FROM transaction_items ti
       JOIN transactions t ON t.id = ti.transaction_id
       WHERE t.store_id = ? AND t.status = 'completed' AND t.created_at >= ? AND t.created_at <= ?
       GROUP BY ti.product_id
       ORDER BY qtySold DESC
       LIMIT 10`
    )
    .all(storeId, from, to);

  res.json({ ...totals, voidedCount, byDay, byMonth, topProducts });
});
