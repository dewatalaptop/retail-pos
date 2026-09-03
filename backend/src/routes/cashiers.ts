import { Router } from "express";
import { z } from "zod";
import { db } from "../db";
import { requireAuth, requireRole } from "../middleware/auth";
import { hashPassword } from "../lib/auth";
import { UserRow } from "../types";
import { notifyDbChanged } from "../db/persistenceHook";
import { asyncHandler } from "../lib/asyncHandler";

export const cashiersRouter = Router();

// Every route here is owner-only — a kasir account (even one with every
// permission flag enabled) can never create or manage other kasir accounts.
cashiersRouter.use(requireAuth, requireRole("admin"));

function serialize(row: UserRow) {
  return {
    id: row.id,
    username: row.username,
    name: row.name,
    active: !!row.active,
    permissions: {
      canViewAllTransactions: !!row.can_view_all_transactions,
      canViewReports: !!row.can_view_reports,
      canManageProducts: !!row.can_manage_products,
      canVoidTransactions: !!row.can_void_transactions,
    },
    createdAt: row.created_at,
  };
}

cashiersRouter.get("/", (req, res) => {
  const rows = db
    .prepare("SELECT * FROM users WHERE store_id = ? AND role = 'kasir' ORDER BY created_at ASC")
    .all(req.user!.storeId) as unknown as UserRow[];
  res.json({ cashiers: rows.map(serialize) });
});

const permissionsSchema = z
  .object({
    canViewAllTransactions: z.boolean(),
    canViewReports: z.boolean(),
    canManageProducts: z.boolean(),
    canVoidTransactions: z.boolean(),
  })
  .partial()
  .default({});

const createSchema = z.object({
  username: z.string().min(3).max(32),
  password: z.string().min(6),
  name: z.string().min(1),
  permissions: permissionsSchema,
});

cashiersRouter.post(
  "/",
  asyncHandler(async (req, res) => {
    const parsed = createSchema.safeParse(req.body);
    if (!parsed.success) {
      return res.status(400).json({ error: parsed.error.issues[0]?.message ?? "Data tidak valid" });
    }
    const { username, password, name, permissions } = parsed.data;
    try {
      const result = db
        .prepare(
          `INSERT INTO users
             (store_id, username, password_hash, name, role,
              can_view_all_transactions, can_view_reports, can_manage_products, can_void_transactions)
           VALUES (?, ?, ?, ?, 'kasir', ?, ?, ?, ?)`
        )
        .run(
          req.user!.storeId,
          username,
          hashPassword(password),
          name,
          permissions.canViewAllTransactions ? 1 : 0,
          permissions.canViewReports ? 1 : 0,
          permissions.canManageProducts ? 1 : 0,
          permissions.canVoidTransactions ? 1 : 0
        );
      const created = db.prepare("SELECT * FROM users WHERE id = ?").get(result.lastInsertRowid) as unknown as UserRow;
      await notifyDbChanged();
      res.status(201).json({ cashier: serialize(created) });
    } catch (err: any) {
      if (String(err.message).includes("UNIQUE")) {
        return res.status(409).json({ error: "Username sudah dipakai — pilih username lain" });
      }
      throw err;
    }
  })
);

const updateSchema = z.object({
  name: z.string().min(1).optional(),
  password: z.string().min(6).optional(),
  active: z.boolean().optional(),
  permissions: permissionsSchema,
});

function getOwnCashier(req: import("express").Request): UserRow | undefined {
  return db
    .prepare("SELECT * FROM users WHERE id = ? AND store_id = ? AND role = 'kasir'")
    .get(req.params.id, req.user!.storeId) as unknown as UserRow | undefined;
}

cashiersRouter.put(
  "/:id",
  asyncHandler(async (req, res) => {
    const existing = getOwnCashier(req);
    if (!existing) return res.status(404).json({ error: "Kasir tidak ditemukan" });

    const parsed = updateSchema.safeParse(req.body);
    if (!parsed.success) {
      return res.status(400).json({ error: parsed.error.issues[0]?.message ?? "Data tidak valid" });
    }
    const p = parsed.data;
    const merged = {
      name: p.name ?? existing.name,
      active: p.active ?? !!existing.active,
      canViewAllTransactions: p.permissions.canViewAllTransactions ?? !!existing.can_view_all_transactions,
      canViewReports: p.permissions.canViewReports ?? !!existing.can_view_reports,
      canManageProducts: p.permissions.canManageProducts ?? !!existing.can_manage_products,
      canVoidTransactions: p.permissions.canVoidTransactions ?? !!existing.can_void_transactions,
    };
    db.prepare(
      `UPDATE users SET name=?, active=?, can_view_all_transactions=?, can_view_reports=?,
       can_manage_products=?, can_void_transactions=?
       WHERE id=?`
    ).run(
      merged.name,
      merged.active ? 1 : 0,
      merged.canViewAllTransactions ? 1 : 0,
      merged.canViewReports ? 1 : 0,
      merged.canManageProducts ? 1 : 0,
      merged.canVoidTransactions ? 1 : 0,
      req.params.id
    );
    if (p.password) {
      db.prepare("UPDATE users SET password_hash = ? WHERE id = ?").run(hashPassword(p.password), req.params.id);
    }

    const updated = db.prepare("SELECT * FROM users WHERE id = ?").get(req.params.id) as unknown as UserRow;
    await notifyDbChanged();
    res.json({ cashier: serialize(updated) });
  })
);

// No hard delete: a kasir's user_id is referenced by every transaction they
// ever rang up (for the audit trail), so removing the row would either
// violate that foreign key or silently orphan history. "Nonaktifkan" (PUT
// active:false, above) blocks their login while keeping their sales history
// intact — that's the intended way to remove a cashier's access.
