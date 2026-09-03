import { Router } from "express";
import { z } from "zod";
import { db } from "../db";
import { requireAuth, requireRole } from "../middleware/auth";
import { StoreSettingsRow } from "../types";
import { notifyDbChanged } from "../db/persistenceHook";
import { asyncHandler } from "../lib/asyncHandler";

export const settingsRouter = Router();

settingsRouter.use(requireAuth);

function getSettings(storeId: number): StoreSettingsRow {
  // Created together with the store itself (see db/stores.ts's createStore),
  // so this should always resolve for any storeId a valid JWT can carry.
  return db.prepare("SELECT * FROM store_settings WHERE store_id = ?").get(storeId) as unknown as StoreSettingsRow;
}

// Open to any authenticated user of the store, not just the owner — a kasir
// needs this too, since it's what drives the footer branding/ad slot they
// see throughout the app (see frontend's SettingsContext). There's no more
// unauthenticated "/public" variant: with multiple stores now, there's no
// single store to show branding for before someone has actually logged in.
settingsRouter.get("/", (req, res) => {
  const s = getSettings(req.user!.storeId);
  res.json({
    storeName: s.store_name,
    storeAddress: s.store_address,
    storePhone: s.store_phone,
    receiptFooter: s.receipt_footer,
    adsenseClientId: s.adsense_client_id,
    adsenseSlotFooter: s.adsense_slot_footer,
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
  adsenseSlotReports: z.string().default(""),
});

settingsRouter.put(
  "/",
  requireRole("admin"),
  asyncHandler(async (req, res) => {
    const parsed = settingsSchema.safeParse(req.body);
    if (!parsed.success) {
      return res.status(400).json({ error: parsed.error.issues[0]?.message ?? "Data tidak valid" });
    }
    const s = parsed.data;
    db.prepare(
      `UPDATE store_settings SET store_name=?, store_address=?, store_phone=?, receipt_footer=?,
       adsense_client_id=?, adsense_slot_footer=?, adsense_slot_reports=?,
       updated_at=datetime('now') WHERE store_id=?`
    ).run(
      s.storeName,
      s.storeAddress,
      s.storePhone,
      s.receiptFooter,
      s.adsenseClientId,
      s.adsenseSlotFooter,
      s.adsenseSlotReports,
      req.user!.storeId
    );
    await notifyDbChanged();
    res.json({ ok: true });
  })
);
