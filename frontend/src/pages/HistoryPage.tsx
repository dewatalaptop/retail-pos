import { useEffect, useState } from "react";
import { api } from "../api/client";
import Receipt, { ReceiptData } from "../components/Receipt";

interface Transaction {
  id: number;
  created_at: string;
  total: number;
  payment_method: string;
}

interface TransactionItem {
  name_snapshot: string;
  qty: number;
  price_snapshot: number;
  discount_percent: number;
}

export default function HistoryPage() {
  const [transactions, setTransactions] = useState<Transaction[]>([]);
  const [from, setFrom] = useState("");
  const [to, setTo] = useState("");
  const [receipt, setReceipt] = useState<ReceiptData | null>(null);

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

  if (receipt) {
    return <Receipt data={receipt} onClose={() => setReceipt(null)} />;
  }

  return (
    <div>
      <div className="mb-3 flex gap-2 text-sm">
        <input type="date" value={from} onChange={(e) => setFrom(e.target.value)} className="rounded border border-slate-300 px-2 py-1.5" />
        <input type="date" value={to} onChange={(e) => setTo(e.target.value)} className="rounded border border-slate-300 px-2 py-1.5" />
      </div>
      <table className="w-full overflow-hidden rounded-lg border border-slate-200 bg-white text-sm shadow-sm">
        <thead className="bg-slate-50 text-left text-xs uppercase text-slate-500">
          <tr>
            <th className="px-3 py-2">ID</th>
            <th className="px-3 py-2">Tanggal</th>
            <th className="px-3 py-2">Metode</th>
            <th className="px-3 py-2">Total</th>
            <th className="px-3 py-2"></th>
          </tr>
        </thead>
        <tbody>
          {transactions.map((t) => (
            <tr key={t.id} className="border-t border-slate-100">
              <td className="px-3 py-2">#{t.id}</td>
              <td className="px-3 py-2">{new Date(t.created_at).toLocaleString("id-ID")}</td>
              <td className="px-3 py-2 capitalize">{t.payment_method}</td>
              <td className="px-3 py-2">Rp{t.total.toLocaleString("id-ID")}</td>
              <td className="px-3 py-2 text-right">
                <button onClick={() => openReceipt(t.id)} className="text-xs text-indigo-600 hover:underline">
                  Lihat struk
                </button>
              </td>
            </tr>
          ))}
          {transactions.length === 0 && (
            <tr>
              <td colSpan={5} className="px-3 py-6 text-center text-slate-400">
                Belum ada transaksi.
              </td>
            </tr>
          )}
        </tbody>
      </table>
    </div>
  );
}
