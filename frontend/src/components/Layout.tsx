import { useEffect, useState } from "react";
import { NavLink, Outlet, useLocation } from "react-router-dom";
import { useAuth } from "../context/AuthContext";
import { useSettings } from "../context/SettingsContext";
import { useStoreLogo } from "../hooks/useStoreLogo";
import LowStockNotification from "./LowStockNotification";
import AdSlot from "./AdSlot";

const linkClass = ({ isActive }: { isActive: boolean }) =>
  `rounded-lg px-3 py-2 text-sm font-medium ${
    isActive ? "bg-[var(--brand-600)] text-white" : "text-slate-600 hover:bg-slate-200"
  }`;

const mobileLinkClass = ({ isActive }: { isActive: boolean }) =>
  `block rounded-lg px-3 py-3 text-base font-medium ${
    isActive ? "bg-[var(--brand-600)] text-white" : "text-slate-700 hover:bg-slate-100"
  }`;

export default function Layout() {
  const { user, logout } = useAuth();
  const { settings } = useSettings();
  const { logoUrl } = useStoreLogo();
  const isAdmin = user?.role === "admin";
  const [menuOpen, setMenuOpen] = useState(false);
  const location = useLocation();

  // A tapped link should close the mobile menu even though Layout stays
  // mounted across the navigation (client-side route change, not a reload).
  useEffect(() => {
    setMenuOpen(false);
  }, [location.pathname]);

  const navLinks: { to: string; end?: boolean; label: string }[] = [
    { to: "/", end: true, label: "Kasir" },
    { to: "/riwayat", label: "Riwayat" },
    ...(settings.businessMode === "warung" ? [{ to: "/kasbon", label: "Kasbon" }] : []),
    ...(isAdmin || user?.permissions.canManageProducts ? [{ to: "/produk", label: "Produk" }] : []),
    ...(isAdmin || user?.permissions.canViewReports ? [{ to: "/laporan", label: "Laporan" }] : []),
    ...(isAdmin ? [{ to: "/kasir", label: "Kelola Kasir" }, { to: "/pengaturan", label: "Pengaturan" }] : []),
    { to: "/bantuan", label: "Bantuan" },
  ];

  return (
    <div className="min-h-screen bg-slate-100">
      <header className="border-b border-slate-200 bg-white">
        <div className="mx-auto flex max-w-6xl items-center justify-between px-4 py-3">
          <div className="flex min-w-0 items-center gap-4">
            <span className="flex min-w-0 items-center gap-2">
              {logoUrl && <img src={logoUrl} alt="" className="h-8 w-8 shrink-0 rounded object-contain" />}
              <span className="truncate text-lg font-bold text-[var(--brand-600)]">{settings.storeName}</span>
            </span>
            <nav className="hidden flex-wrap gap-1 lg:flex">
              {navLinks.map((item) => (
                <NavLink key={item.to} to={item.to} end={item.end} className={linkClass}>
                  {item.label}
                </NavLink>
              ))}
            </nav>
          </div>
          <div className="flex items-center gap-2 text-sm">
            <LowStockNotification />
            <div className="hidden items-center gap-3 lg:flex">
              <span className="text-slate-500">
                {user?.name}{" "}
                <span className="text-slate-400">({user?.role === "admin" ? "pemilik" : "kasir"})</span>
              </span>
              <button onClick={logout} className="text-rose-600 hover:underline">
                Keluar
              </button>
            </div>
            <button
              onClick={() => setMenuOpen((v) => !v)}
              className="flex h-10 w-10 items-center justify-center rounded-lg text-slate-600 hover:bg-slate-100 lg:hidden"
              aria-label={menuOpen ? "Tutup menu" : "Buka menu"}
              aria-expanded={menuOpen}
            >
              {menuOpen ? (
                <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                  <path d="M6 6l12 12M18 6L6 18" strokeLinecap="round" />
                </svg>
              ) : (
                <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                  <path d="M4 7h16M4 12h16M4 17h16" strokeLinecap="round" />
                </svg>
              )}
            </button>
          </div>
        </div>

        {menuOpen && (
          <nav className="border-t border-slate-200 px-4 py-2 lg:hidden">
            <div className="flex flex-col gap-1">
              {navLinks.map((item) => (
                <NavLink key={item.to} to={item.to} end={item.end} className={mobileLinkClass}>
                  {item.label}
                </NavLink>
              ))}
            </div>
            <div className="mt-2 flex items-center justify-between border-t border-slate-100 px-3 py-3">
              <span className="text-sm text-slate-500">
                {user?.name}{" "}
                <span className="text-slate-400">({user?.role === "admin" ? "pemilik" : "kasir"})</span>
              </span>
              <button onClick={logout} className="rounded-lg px-3 py-1.5 text-sm font-medium text-rose-600 hover:bg-rose-50">
                Keluar
              </button>
            </div>
          </nav>
        )}
      </header>
      <main className="mx-auto max-w-6xl p-4">
        <Outlet />
      </main>
      <footer className="mx-auto max-w-6xl px-4 pb-6">
        <AdSlot clientId={settings.adsenseClientId} slotId={settings.adsenseSlotFooter} />
      </footer>
    </div>
  );
}
