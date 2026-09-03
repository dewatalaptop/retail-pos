import { Router } from "express";
import { z } from "zod";
import { db } from "../db";
import { requireAuth } from "../middleware/auth";
import { HeldCartRow } from "../types";
import { notifyDbChanged } from "../db/persistenceHook";
import { asyncHandler } from "../lib/asyncHandler";

export const heldCartsRouter = Router();

heldCartsRouter.use(requireAuth);

const cartItemSchema = z.object({
  productId: z.number().int().positive(),
  qty: z.number().int().positive(),
  discountPercent: z.number().min(0).max(100).default(0),
});

const holdSchema = z.object({
  label: z.string().default(""),
  items: z.array(cartItemSchema).min(1),
});

function serialize(row: HeldCartRow) {
  return { id: row.id, label: row.label, items: JSON.parse(row.items_json), createdAt: row.created_at };
}

// A parked sale — the cashier hands the register to someone else, or a
// customer needs a moment, without losing what's already in the cart. Only
// the cashier who parked it can see or resume it (own user_id), same as
// transaction history.
heldCartsRouter.get("/", (req, res) => {
  const rows = db
    .prepare("SELECT * FROM held_carts WHERE user_id = ? ORDER BY created_at DESC")
    .all(req.user!.userId) as unknown as HeldCartRow[];
  res.json({ heldCarts: rows.map(serialize) });
});

heldCartsRouter.post(
  "/",
  asyncHandler(async (req, res) => {
    const parsed = holdSchema.safeParse(req.body);
    if (!parsed.success) {
      return res.status(400).json({ error: parsed.error.issues[0]?.message ?? "Data tidak valid" });
    }
    const { label, items } = parsed.data;
    const result = db
      .prepare("INSERT INTO held_carts (user_id, label, items_json) VALUES (?, ?, ?)")
      .run(req.user!.userId, label, JSON.stringify(items));
    const created = db.prepare("SELECT * FROM held_carts WHERE id = ?").get(result.lastInsertRowid) as unknown as
      | HeldCartRow
      | undefined;
    await notifyDbChanged();
    res.status(201).json({ heldCart: serialize(created!) });
  })
);

heldCartsRouter.delete(
  "/:id",
  asyncHandler(async (req, res) => {
    const existing = db.prepare("SELECT * FROM held_carts WHERE id = ?").get(req.params.id) as unknown as
      | HeldCartRow
      | undefined;
    if (!existing) return res.status(404).json({ error: "Transaksi tertahan tidak ditemukan" });
    if (existing.user_id !== req.user!.userId) {
      return res.status(403).json({ error: "Tidak punya akses ke transaksi tertahan ini" });
    }
    db.prepare("DELETE FROM held_carts WHERE id = ?").run(req.params.id);
    await notifyDbChanged();
    res.status(204).end();
  })
);
