import { Router } from "express";
import { db } from "../db";
import { requireAuth, requireRole } from "../middleware/auth";

export const reportsRouter = Router();

reportsRouter.use(requireAuth, requireRole("admin"));

reportsRouter.get("/summary", (req, res) => {
  const from = String(req.query.from ?? "1970-01-01");
  const to = String(req.query.to ?? "9999-12-31");

  const totals = db
    .prepare(
      `SELECT COUNT(*) as transactionCount, COALESCE(SUM(total), 0) as revenue
       FROM transactions WHERE created_at >= ? AND created_at <= ?`
    )
    .get(from, to) as { transactionCount: number; revenue: number };

  const byDay = db
    .prepare(
      `SELECT date(created_at) as day, COALESCE(SUM(total), 0) as revenue, COUNT(*) as transactionCount
       FROM transactions WHERE created_at >= ? AND created_at <= ?
       GROUP BY day ORDER BY day ASC`
    )
    .all(from, to);

  const byMonth = db
    .prepare(
      `SELECT strftime('%Y-%m', created_at) as month, COALESCE(SUM(total), 0) as revenue, COUNT(*) as transactionCount
       FROM transactions WHERE created_at >= ? AND created_at <= ?
       GROUP BY month ORDER BY month ASC`
    )
    .all(from, to);

  const topProducts = db
    .prepare(
      `SELECT ti.product_id as productId, ti.name_snapshot as name,
              SUM(ti.qty) as qtySold, SUM(ti.line_total) as revenue
       FROM transaction_items ti
       JOIN transactions t ON t.id = ti.transaction_id
       WHERE t.created_at >= ? AND t.created_at <= ?
       GROUP BY ti.product_id
       ORDER BY qtySold DESC
       LIMIT 10`
    )
    .all(from, to);

  res.json({ ...totals, byDay, byMonth, topProducts });
});
