import { useEffect, useState } from "react";
import { api, ApiError } from "../api/client";
import { useAuth } from "../context/AuthContext";
import { useSettings } from "../context/SettingsContext";
import Receipt, { ReceiptData } from "../components/Receipt";

interface Transaction {
  id: number;
  created_at: string;
  total: number;
  payment_method: string;
  status: "completed" | "voided";
}

interface TransactionItem {
  name_snapshot: string;
  qty: number;
  price_snapshot: number;
  discount_percent: number;
}

export default function HistoryPage() {
  const { user } = useAuth();
  const { settings } = useSettings();
  const [transactions, setTransactions] = useState<Transaction[]>([]);
  const [from, setFrom] = useState("");
  const [to, setTo] = useState("");
  const [receipt, setReceipt] = useState<ReceiptData | null>(null);
  const [confirmVoidId, setConfirmVoidId] = useState<number | null>(null);
  const [voidError, setVoidError] = useState("");

  useEffect(() => {
    load();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [from, to]);

  async function load() {
    const params = new URLSearchParams();
    if (from) params.set("from", from);
    if (to) params.set("to", to);
    const res = await api<{ transactions: Transaction[] }>(`/transactions?${params}`);
    setTransactions(res.transactions);
  }

  async function openReceipt(id: number) {
    const res = await api<{ transaction: any; items: TransactionItem[] }>(`/transactions/${id}`);
    const t = res.transaction;
    setReceipt({
      transactionId: t.id,
      items: res.items.map((i) => ({
        name: i.name_snapshot,
        qty: i.qty,
        price: i.price_snapshot,
        discountPercent: i.discount_percent,
      })),
      subtotal: t.subtotal,
      discountTotal: t.discount_total,
      taxTotal: t.tax_total,
      total: t.total,
      paymentMethod: t.payment_method,
      cashReceived: t.cash_received ?? undefined,
      changeDue: t.change_due ?? undefined,
      createdAt: t.created_at,
    });
  }

  async function voidTransaction(id: number) {
    if (confirmVoidId !== id) {
      // First click just arms the confirm state; it self-disarms after a
      // few seconds so a stray second click later can't accidentally void.
      setConfirmVoidId(id);
      setTimeout(() => setConfirmVoidId((cur) => (cur === id ? null : cur)), 4000);
      return;
    }
    setConfirmVoidId(null);
    setVoidError("");
    try {
      await api(`/transactions/${id}/void`, { method: "POST", body: JSON.stringify({}) });
      load();
    } catch (err) {
      setVoidError(err instanceof ApiError ? err.message : "Gagal membatalkan transaksi");
    }
  }

  if (receipt) {
    return (
      <Receipt
        data={receipt}
        onClose={() => setReceipt(null)}
        closeLabel="Kembali ke riwayat"
        storeName={settings.storeName}
        footerNote={settings.receiptFooter}
      />
    );
  }

  return (
    <div>
      <div className="mb-3 flex gap-2 text-sm">
        <input type="date" value={from} onChange={(e) => setFrom(e.target.value)} className="rounded border border-slate-300 px-2 py-1.5" />
        <input type="date" value={to} onChange={(e) => setTo(e.target.value)} className="rounded border border-slate-300 px-2 py-1.5" />
      </div>
      {voidError && <p className="mb-2 text-sm text-rose-600">{voidError}</p>}
      <table className="w-full overflow-hidden rounded-lg border border-slate-200 bg-white text-sm shadow-sm">
        <thead className="bg-slate-50 text-left text-xs uppercase text-slate-500">
          <tr>
            <th className="px-3 py-2">ID</th>
            <th className="px-3 py-2">Tanggal</th>
            <th className="px-3 py-2">Metode</th>
            <th className="px-3 py-2">Status</th>
            <th className="px-3 py-2">Total</th>
            <th className="px-3 py-2"></th>
          </tr>
        </thead>
        <tbody>
          {transactions.map((t) => (
            <tr key={t.id} className={`border-t border-slate-100 ${t.status === "voided" ? "opacity-50" : ""}`}>
              <td className="px-3 py-2">#{t.id}</td>
              <td className="px-3 py-2">{new Date(t.created_at).toLocaleString("id-ID")}</td>
              <td className="px-3 py-2 capitalize">{t.payment_method}</td>
              <td className="px-3 py-2">
                {t.status === "voided" ? (
                  <span className="rounded-full bg-rose-100 px-2 py-0.5 text-xs font-medium text-rose-600">
                    Dibatalkan
                  </span>
                ) : (
                  <span className="rounded-full bg-emerald-100 px-2 py-0.5 text-xs font-medium text-emerald-700">
                    Selesai
                  </span>
                )}
              </td>
              <td className="px-3 py-2">Rp{t.total.toLocaleString("id-ID")}</td>
              <td className="px-3 py-2 text-right">
                <div className="flex justify-end gap-3">
                  <button onClick={() => openReceipt(t.id)} className="text-xs text-indigo-600 hover:underline">
                    Lihat struk
                  </button>
                  {user?.role === "admin" && t.status !== "voided" && (
                    <button
                      onClick={() => voidTransaction(t.id)}
                      className={`text-xs font-medium hover:underline ${
                        confirmVoidId === t.id ? "text-rose-700" : "text-rose-500"
                      }`}
                    >
                      {confirmVoidId === t.id ? "Yakin?" : "Batalkan"}
                    </button>
                  )}
                </div>
              </td>
            </tr>
          ))}
          {transactions.length === 0 && (
            <tr>
              <td colSpan={6} className="px-3 py-6 text-center text-slate-400">
                Belum ada transaksi.
              </td>
            </tr>
          )}
        </tbody>
      </table>
    </div>
  );
}
