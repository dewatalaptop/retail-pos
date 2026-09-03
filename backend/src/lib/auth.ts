import bcrypt from "bcryptjs";
import jwt from "jsonwebtoken";
import { UserRow } from "../types";

const JWT_SECRET = process.env.JWT_SECRET || "retail-pos-dev-secret-change-me";
const TOKEN_TTL = "12h";

export interface AuthPermissions {
  canViewAllTransactions: boolean;
  canViewReports: boolean;
  canManageProducts: boolean;
  canVoidTransactions: boolean;
}

export interface AuthTokenPayload {
  userId: number;
  storeId: number;
  username: string | null;
  role: "admin" | "kasir";
  name: string;
  // An admin (store owner) implicitly has every permission regardless of
  // these flags — see middleware/auth.ts's requirePermission. They only ever
  // gate a kasir account, and are set by the owner when creating/editing one
  // (see routes/cashiers.ts).
  permissions: AuthPermissions;
}

export function hashPassword(plain: string): string {
  return bcrypt.hashSync(plain, 10);
}

export function verifyPassword(plain: string, hash: string): boolean {
  return bcrypt.compareSync(plain, hash);
}

export function signToken(payload: AuthTokenPayload): string {
  return jwt.sign(payload, JWT_SECRET, { expiresIn: TOKEN_TTL });
}

export function verifyToken(token: string): AuthTokenPayload {
  return jwt.verify(token, JWT_SECRET) as AuthTokenPayload;
}

/** Shared by both login paths (username/password and Google) so the token shape never drifts between them. */
export function toTokenPayload(user: UserRow): AuthTokenPayload {
  return {
    userId: user.id,
    storeId: user.store_id,
    username: user.username,
    role: user.role,
    name: user.name,
    permissions: {
      canViewAllTransactions: !!user.can_view_all_transactions,
      canViewReports: !!user.can_view_reports,
      canManageProducts: !!user.can_manage_products,
      canVoidTransactions: !!user.can_void_transactions,
    },
  };
}
