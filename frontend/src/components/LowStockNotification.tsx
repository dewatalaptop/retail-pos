import { useEffect, useState } from "react";
import { api } from "../api/client";

interface LowStockProduct {
  id: number;
  sku: string;
  name: string;
  stock: number;
  low_stock_threshold: number;
}

const POLL_INTERVAL_MS = 30000;

export default function LowStockNotification() {
  const [products, setProducts] = useState<LowStockProduct[]>([]);
  const [open, setOpen] = useState(false);

  useEffect(() => {
    let cancelled = false;
    async function load() {
      try {
        const res = await api<{ products: LowStockProduct[] }>("/products/low-stock");
        if (!cancelled) setProducts(res.products);
      } catch {
        // silently ignore transient failures; next poll will retry
      }
    }
    load();
    const interval = setInterval(load, POLL_INTERVAL_MS);
    return () => {
      cancelled = true;
      clearInterval(interval);
    };
  }, []);

  return (
    <div className="relative">
      <button
        onClick={() => setOpen((v) => !v)}
        className="relative rounded-lg px-2 py-1.5 text-slate-600 hover:bg-slate-200"
        aria-label="Notifikasi stok rendah"
      >
        <span aria-hidden="true">🔔</span>
        {products.length > 0 && (
          <span className="absolute -right-1 -top-1 flex h-4 min-w-4 items-center justify-center rounded-full bg-rose-600 px-1 text-[10px] font-bold text-white">
            {products.length}
          </span>
        )}
      </button>

      {open && (
        <div className="absolute right-0 z-10 mt-2 w-72 rounded-lg border border-slate-200 bg-white p-3 shadow-lg">
          <p className="mb-2 text-xs font-semibold uppercase text-slate-500">Stok rendah</p>
          {products.length === 0 ? (
            <p className="text-sm text-slate-400">Semua stok aman.</p>
          ) : (
            <ul className="flex flex-col gap-2">
              {products.map((p) => (
                <li key={p.id} className="flex items-center justify-between text-sm">
                  <div>
                    <p className="font-medium text-slate-800">{p.name}</p>
                    <p className="text-xs text-slate-400">{p.sku}</p>
                  </div>
                  <span className="font-medium text-amber-600">
                    {p.stock} / {p.low_stock_threshold}
                  </span>
                </li>
              ))}
            </ul>
          )}
        </div>
      )}
    </div>
  );
}
