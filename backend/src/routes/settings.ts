import { Router } from "express";
import { z } from "zod";
import { db } from "../db";
import { requireAuth, requireRole } from "../middleware/auth";
import { StoreSettingsRow } from "../types";
import { notifyDbChanged } from "../db/persistenceHook";
import { asyncHandler } from "../lib/asyncHandler";

export const settingsRouter = Router();

function getSettings(): StoreSettingsRow {
  // The row is seeded on first boot (see db/seed.ts) and never deleted, so
  // this should always resolve — the `!` documents that invariant rather
  // than papering over a real "missing settings" case.
  return db.prepare("SELECT * FROM store_settings WHERE id = 1").get() as unknown as StoreSettingsRow;
}

// Deliberately unauthenticated: the login page (no token yet) needs the
// store name + AdSense config to render its branding and ad slot, and an
// AdSense client/slot id is meant to be public (it's embedded in page HTML
// for every visitor anyway) — nothing here is sensitive.
settingsRouter.get("/public", (_req, res) => {
  const s = getSettings();
  res.json({
    storeName: s.store_name,
    receiptFooter: s.receipt_footer,
    adsenseClientId: s.adsense_client_id,
    adsenseSlotFooter: s.adsense_slot_footer,
    adsenseSlotLogin: s.adsense_slot_login,
    adsenseSlotReports: s.adsense_slot_reports,
  });
});

settingsRouter.get("/", requireAuth, requireRole("admin"), (_req, res) => {
  const s = getSettings();
  res.json({
    storeName: s.store_name,
    storeAddress: s.store_address,
    storePhone: s.store_phone,
    receiptFooter: s.receipt_footer,
    adsenseClientId: s.adsense_client_id,
    adsenseSlotFooter: s.adsense_slot_footer,
    adsenseSlotLogin: s.adsense_slot_login,
    adsenseSlotReports: s.adsense_slot_reports,
  });
});

const settingsSchema = z.object({
  storeName: z.string().min(1),
  storeAddress: z.string().default(""),
  storePhone: z.string().default(""),
  receiptFooter: z.string().default(""),
  adsenseClientId: z.string().default(""),
  adsenseSlotFooter: z.string().default(""),
  adsenseSlotLogin: z.string().default(""),
  adsenseSlotReports: z.string().default(""),
});

settingsRouter.put(
  "/",
  requireAuth,
  requireRole("admin"),
  asyncHandler(async (req, res) => {
    const parsed = settingsSchema.safeParse(req.body);
    if (!parsed.success) {
      return res.status(400).json({ error: parsed.error.issues[0]?.message ?? "Data tidak valid" });
    }
    const s = parsed.data;
    db.prepare(
      `UPDATE store_settings SET store_name=?, store_address=?, store_phone=?, receipt_footer=?,
       adsense_client_id=?, adsense_slot_footer=?, adsense_slot_login=?, adsense_slot_reports=?,
       updated_at=datetime('now') WHERE id=1`
    ).run(
      s.storeName,
      s.storeAddress,
      s.storePhone,
      s.receiptFooter,
      s.adsenseClientId,
      s.adsenseSlotFooter,
      s.adsenseSlotLogin,
      s.adsenseSlotReports
    );
    await notifyDbChanged();
    res.json({ ok: true });
  })
);
