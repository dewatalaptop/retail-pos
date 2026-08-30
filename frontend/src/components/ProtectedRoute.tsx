import { Navigate } from "react-router-dom";
import { ReactNode } from "react";
import { useAuth } from "../context/AuthContext";

export default function ProtectedRoute({
  children,
  roles,
}: {
  children: ReactNode;
  roles?: Array<"admin" | "kasir">;
}) {
  const { user, loading } = useAuth();

  if (loading) return <div className="p-8 text-center text-slate-500">Memuat...</div>;
  if (!user) return <Navigate to="/login" replace />;
  if (roles && !roles.includes(user.role)) return <Navigate to="/" replace />;

  return <>{children}</>;
}
