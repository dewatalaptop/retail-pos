import { Router } from "express";
import { z } from "zod";
import { db } from "../db";
import { verifyPassword, signToken } from "../lib/auth";
import { requireAuth } from "../middleware/auth";
import { UserRow } from "../types";

export const authRouter = Router();

const loginSchema = z.object({
  username: z.string().min(1),
  password: z.string().min(1),
});

authRouter.post("/login", (req, res) => {
  const parsed = loginSchema.safeParse(req.body);
  if (!parsed.success) {
    return res.status(400).json({ error: "username dan password wajib diisi" });
  }
  const { username, password } = parsed.data;

  const user = db
    .prepare("SELECT * FROM users WHERE username = ?")
    .get(username) as unknown as UserRow | undefined;

  if (!user || !verifyPassword(password, user.password_hash)) {
    return res.status(401).json({ error: "Username atau password salah" });
  }

  const token = signToken({
    userId: user.id,
    username: user.username,
    role: user.role,
    name: user.name,
  });

  res.json({
    token,
    user: { id: user.id, username: user.username, name: user.name, role: user.role },
  });
});

authRouter.get("/me", requireAuth, (req, res) => {
  res.json({ user: req.user });
});
