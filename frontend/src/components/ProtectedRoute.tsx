import { Navigate } from "react-router-dom";
import { ReactNode } from "react";
import { useAuth, AuthPermissions } from "../context/AuthContext";

export default function ProtectedRoute({
  children,
  roles,
  permission,
}: {
  children: ReactNode;
  roles?: Array<"admin" | "kasir">;
  /** Owner (role admin) always passes regardless — see AuthContext's AuthPermissions. */
  permission?: keyof AuthPermissions;
}) {
  const { user, loading } = useAuth();

  if (loading) return <div className="p-8 text-center text-slate-500">Memuat...</div>;
  if (!user) return <Navigate to="/login" replace />;
  if (roles && !roles.includes(user.role)) return <Navigate to="/" replace />;
  if (permission && user.role !== "admin" && !user.permissions[permission]) return <Navigate to="/" replace />;

  return <>{children}</>;
}
