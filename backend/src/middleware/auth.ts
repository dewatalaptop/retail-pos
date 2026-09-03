import { Request, Response, NextFunction } from "express";
import { verifyToken, AuthTokenPayload, AuthPermissions } from "../lib/auth";

declare global {
  // eslint-disable-next-line @typescript-eslint/no-namespace
  namespace Express {
    interface Request {
      user?: AuthTokenPayload;
    }
  }
}

export function requireAuth(req: Request, res: Response, next: NextFunction) {
  const header = req.headers.authorization;
  if (!header?.startsWith("Bearer ")) {
    return res.status(401).json({ error: "Tidak terautentikasi" });
  }
  try {
    const payload = verifyToken(header.slice("Bearer ".length));
    // A token issued before storeId existed in the payload (or otherwise
    // malformed) verifies fine — the signature is still valid — but every
    // route downstream assumes storeId is a real number and will crash with
    // a raw SQLite binding error on `undefined` rather than a clean 401.
    // Reject it here instead: same as an expired token, the fix is to log in
    // again and get a fresh one.
    if (typeof payload.storeId !== "number") {
      return res.status(401).json({ error: "Sesi kedaluwarsa, silakan masuk kembali" });
    }
    req.user = payload;
    next();
  } catch {
    return res.status(401).json({ error: "Token tidak valid atau kedaluwarsa" });
  }
}

export function requireRole(...roles: Array<"admin" | "kasir">) {
  return (req: Request, res: Response, next: NextFunction) => {
    if (!req.user || !roles.includes(req.user.role)) {
      return res.status(403).json({ error: "Tidak punya akses" });
    }
    next();
  };
}

/**
 * Gates a route behind one of the owner-configurable kasir permission flags
 * (see lib/auth.ts's AuthPermissions). An admin (store owner) always passes
 * regardless of the flag — the flags exist to selectively open up parts of
 * the app to a kasir, not to restrict the owner.
 */
export function requirePermission(permission: keyof AuthPermissions) {
  return (req: Request, res: Response, next: NextFunction) => {
    if (!req.user) return res.status(401).json({ error: "Tidak terautentikasi" });
    if (req.user.role === "admin" || req.user.permissions[permission]) return next();
    return res.status(403).json({ error: "Tidak punya akses" });
  };
}
