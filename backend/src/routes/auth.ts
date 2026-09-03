import { Router } from "express";
import { z } from "zod";
import { db } from "../db";
import { verifyPassword, signToken, toTokenPayload } from "../lib/auth";
import { verifyGoogleIdToken } from "../lib/googleAuth";
import { createStore } from "../db/stores";
import { requireAuth } from "../middleware/auth";
import { UserRow } from "../types";
import { asyncHandler } from "../lib/asyncHandler";
import { notifyDbChanged } from "../db/persistenceHook";

export const authRouter = Router();

const loginSchema = z.object({
  username: z.string().min(1),
  password: z.string().min(1),
});

// Cashier login — username/password set by their store's owner (see
// routes/cashiers.ts). Owners never use this; they sign in with Google below.
authRouter.post("/login", (req, res) => {
  const parsed = loginSchema.safeParse(req.body);
  if (!parsed.success) {
    return res.status(400).json({ error: "username dan password wajib diisi" });
  }
  const { username, password } = parsed.data;

  const user = db
    .prepare("SELECT * FROM users WHERE username = ? AND active = 1")
    .get(username) as unknown as UserRow | undefined;

  if (!user || !user.password_hash || !verifyPassword(password, user.password_hash)) {
    return res.status(401).json({ error: "Username atau password salah" });
  }

  const token = signToken(toTokenPayload(user));
  res.json({ token, user: toTokenPayload(user) });
});

const googleSchema = z.object({ idToken: z.string().min(1) });

// Store owner login/signup in one step: the first time a Google account
// shows up here, it gets a brand-new empty store (no demo products — real
// businesses shouldn't start with fake data); every time after that, it logs
// back into the same store. There's no separate "register" flow for owners.
authRouter.post(
  "/google",
  asyncHandler(async (req, res) => {
    const parsed = googleSchema.safeParse(req.body);
    if (!parsed.success) {
      return res.status(400).json({ error: "idToken wajib diisi" });
    }

    let identity;
    try {
      identity = await verifyGoogleIdToken(parsed.data.idToken);
    } catch {
      return res.status(401).json({ error: "Token Google tidak valid atau kedaluwarsa" });
    }

    let user = db.prepare("SELECT * FROM users WHERE google_uid = ?").get(identity.uid) as unknown as
      | UserRow
      | undefined;

    if (!user) {
      const storeId = createStore(`Toko ${identity.name}`);
      db.prepare(
        "INSERT INTO users (store_id, google_uid, name, role) VALUES (?, ?, ?, 'admin')"
      ).run(storeId, identity.uid, identity.name);
      user = db.prepare("SELECT * FROM users WHERE google_uid = ?").get(identity.uid) as unknown as UserRow;
      await notifyDbChanged();
    } else if (!user.active) {
      return res.status(403).json({ error: "Akun ini dinonaktifkan" });
    }

    const token = signToken(toTokenPayload(user));
    res.json({ token, user: toTokenPayload(user) });
  })
);

authRouter.get("/me", requireAuth, (req, res) => {
  res.json({ user: req.user });
});
