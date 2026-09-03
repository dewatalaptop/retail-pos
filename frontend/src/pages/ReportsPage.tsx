import { useEffect, useState } from "react";
import { api } from "../api/client";
import { useSettings } from "../context/SettingsContext";
import AdSlot from "../components/AdSlot";

interface Summary {
  transactionCount: number;
  revenue: number;
  voidedCount: number;
  byDay: { day: string; revenue: number; transactionCount: number }[];
  byMonth: { month: string; revenue: number; transactionCount: number }[];
  topProducts: { productId: number; name: string; qtySold: number; revenue: number }[];
}

interface LowStockProduct {
  id: number;
  name: string;
  stock: number;
  low_stock_threshold: number;
}

export default function ReportsPage() {
  const { settings } = useSettings();
  const [summary, setSummary] = useState<Summary | null>(null);
  const [lowStock, setLowStock] = useState<LowStockProduct[]>([]);
  const [from, setFrom] = useState("");
  const [to, setTo] = useState("");
  const [period, setPeriod] = useState<"harian" | "bulanan">("harian");

  useEffect(() => {
    load();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [from, to]);

  async function load() {
    const params = new URLSearchParams();
    if (from) params.set("from", from);
    if (to) params.set("to", to);
    const [summaryRes, lowStockRes] = await Promise.all([
      api<Summary>(`/reports/summary?${params}`),
      api<{ products: LowStockProduct[] }>("/products/low-stock"),
    ]);
    setSummary(summaryRes);
    setLowStock(lowStockRes.products);
  }

  const rows =
    period === "harian"
      ? (summary?.byDay.map((d) => ({ label: d.day, revenue: d.revenue })) ?? [])
      : (summary?.byMonth.map((m) => ({ label: m.month, revenue: m.revenue })) ?? []);
  const maxRevenue = Math.max(1, ...rows.map((r) => r.revenue), 0);

  return (
    <div className="flex flex-col gap-4">
      <div className="flex gap-2 text-sm">
        <input
          type="date"
          value={from}
          onChange={(e) => setFrom(e.target.value)}
          className="min-w-0 flex-1 rounded border border-slate-300 px-2 py-2.5 sm:flex-none"
        />
        <input
          type="date"
          value={to}
          onChange={(e) => setTo(e.target.value)}
          className="min-w-0 flex-1 rounded border border-slate-300 px-2 py-2.5 sm:flex-none"
        />
      </div>

      {lowStock.length > 0 && (
        <div className="rounded-lg border border-amber-300 bg-amber-50 p-3 text-sm text-amber-800">
          <strong>Stok rendah:</strong>{" "}
          {lowStock.map((p) => `${p.name} (${p.stock})`).join(", ")}
        </div>
      )}

      <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
        <div className="rounded-lg border border-slate-200 bg-white p-4 shadow-sm">
          <p className="text-xs uppercase text-slate-500">Total pendapatan</p>
          <p className="text-2xl font-bold text-slate-900">Rp{(summary?.revenue ?? 0).toLocaleString("id-ID")}</p>
        </div>
        <div className="rounded-lg border border-slate-200 bg-white p-4 shadow-sm">
          <p className="text-xs uppercase text-slate-500">Jumlah transaksi</p>
          <p className="text-2xl font-bold text-slate-900">{summary?.transactionCount ?? 0}</p>
          {(summary?.voidedCount ?? 0) > 0 && (
            <p className="mt-1 text-xs text-slate-400">
              +{summary?.voidedCount} dibatalkan (tidak dihitung di atas)
            </p>
          )}
        </div>
      </div>

      <div className="rounded-lg border border-slate-200 bg-white p-4 shadow-sm">
        <div className="mb-3 flex items-center justify-between">
          <h3 className="text-sm font-semibold text-slate-700">Penjualan {period}</h3>
          <div className="flex gap-1 text-xs">
            <button
              onClick={() => setPeriod("harian")}
              className={`rounded px-2.5 py-1.5 font-medium ${period === "harian" ? "bg-[var(--brand-600)] text-white" : "bg-slate-100 text-slate-600"}`}
            >
              Harian
            </button>
            <button
              onClick={() => setPeriod("bulanan")}
              className={`rounded px-2.5 py-1.5 font-medium ${period === "bulanan" ? "bg-[var(--brand-600)] text-white" : "bg-slate-100 text-slate-600"}`}
            >
              Bulanan
            </button>
          </div>
        </div>
        <div className="flex flex-col gap-1.5">
          {rows.map((r) => (
            <div key={r.label} className="flex items-center gap-2 text-xs">
              <span className="w-14 shrink-0 truncate text-slate-500 sm:w-24">{r.label}</span>
              <div className="h-4 flex-1 rounded bg-slate-100">
                <div
                  className="h-4 rounded bg-[var(--brand-500)]"
                  style={{ width: `${(r.revenue / maxRevenue) * 100}%` }}
                />
              </div>
              <span className="w-20 shrink-0 text-right text-slate-600 sm:w-24">
                Rp{r.revenue.toLocaleString("id-ID")}
              </span>
            </div>
          ))}
          {rows.length === 0 && <p className="text-sm text-slate-400">Belum ada data.</p>}
        </div>
      </div>

      <div className="rounded-lg border border-slate-200 bg-white p-4 shadow-sm">
        <h3 className="mb-3 text-sm font-semibold text-slate-700">Produk terlaris</h3>
        <div className="overflow-x-auto">
          <table className="w-full min-w-[360px] text-sm">
            <thead className="text-left text-xs uppercase text-slate-500">
              <tr>
                <th className="py-1">Produk</th>
                <th className="py-1">Terjual</th>
                <th className="py-1">Pendapatan</th>
              </tr>
            </thead>
            <tbody>
              {summary?.topProducts.map((p) => (
                <tr key={p.productId} className="border-t border-slate-100">
                  <td className="py-1.5">{p.name}</td>
                  <td className="whitespace-nowrap py-1.5">{p.qtySold}</td>
                  <td className="whitespace-nowrap py-1.5">Rp{p.revenue.toLocaleString("id-ID")}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      <AdSlot clientId={settings.adsenseClientId} slotId={settings.adsenseSlotReports} />
    </div>
  );
}
