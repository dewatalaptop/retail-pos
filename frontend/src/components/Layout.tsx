import { NavLink, Outlet } from "react-router-dom";
import { useAuth } from "../context/AuthContext";
import LowStockNotification from "./LowStockNotification";

const linkClass = ({ isActive }: { isActive: boolean }) =>
  `rounded-lg px-3 py-2 text-sm font-medium ${
    isActive ? "bg-indigo-600 text-white" : "text-slate-600 hover:bg-slate-200"
  }`;

export default function Layout() {
  const { user, logout } = useAuth();

  return (
    <div className="min-h-screen bg-slate-100">
      <header className="border-b border-slate-200 bg-white">
        <div className="mx-auto flex max-w-6xl items-center justify-between px-4 py-3">
          <div className="flex items-center gap-2">
            <span className="text-lg font-bold text-indigo-600">Retail POS</span>
            <nav className="ml-4 flex gap-1">
              <NavLink to="/" end className={linkClass}>
                Kasir
              </NavLink>
              <NavLink to="/riwayat" className={linkClass}>
                Riwayat
              </NavLink>
              {user?.role === "admin" && (
                <>
                  <NavLink to="/produk" className={linkClass}>
                    Produk
                  </NavLink>
                  <NavLink to="/laporan" className={linkClass}>
                    Laporan
                  </NavLink>
                </>
              )}
            </nav>
          </div>
          <div className="flex items-center gap-3 text-sm">
            {user?.role === "admin" && <LowStockNotification />}
            <span className="text-slate-500">
              {user?.name} <span className="text-slate-400">({user?.role})</span>
            </span>
            <button onClick={logout} className="text-rose-600 hover:underline">
              Keluar
            </button>
          </div>
        </div>
      </header>
      <main className="mx-auto max-w-6xl p-4">
        <Outlet />
      </main>
    </div>
  );
}
