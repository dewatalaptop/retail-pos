import { useEffect, useState } from "react";
import { api, ApiError } from "../api/client";

interface DebtTransaction {
  id: number;
  created_at: string;
  total: number;
  customer_name: string;
}

// Warung mode's credit/tab tracking — every transaction paid with 'hutang'
// stays unpaid (debt_paid_at NULL) until someone taps "Tandai lunas" here.
// See backend/src/routes/transactions.ts's /debts/unpaid + /:id/mark-paid.
export default function DebtsPage() {
  const [debts, setDebts] = useState<DebtTransaction[]>([]);
  const [loading, setLoading] = useState(true);
  const [confirmId, setConfirmId] = useState<number | null>(null);
  const [error, setError] = useState("");
  const [busyId, setBusyId] = useState<number | null>(null);

  useEffect(() => {
    load();
  }, []);

  async function load() {
    setLoading(true);
    try {
      const res = await api<{ transactions: DebtTransaction[] }>("/transactions/debts/unpaid");
      setDebts(res.transactions);
    } finally {
      setLoading(false);
    }
  }

  async function markPaid(id: number) {
    if (confirmId !== id) {
      setConfirmId(id);
      setTimeout(() => setConfirmId((cur) => (cur === id ? null : cur)), 4000);
      return;
    }
    setConfirmId(null);
    setBusyId(id);
    setError("");
    try {
      await api(`/transactions/${id}/mark-paid`, { method: "POST", body: JSON.stringify({}) });
      load();
    } catch (err) {
      setError(err instanceof ApiError ? err.message : "Gagal menandai lunas");
    } finally {
      setBusyId(null);
    }
  }

  const totalOutstanding = debts.reduce((sum, d) => sum + d.total, 0);

  return (
    <div>
      <div className="mb-4">
        <h1 className="text-lg font-semibold text-slate-800">Kasbon</h1>
        <p className="text-sm text-slate-500">
          Daftar transaksi hutang pelanggan yang belum lunas. Tandai lunas setelah pelanggan membayar.
        </p>
      </div>

      {!loading && debts.length > 0 && (
        <div className="mb-3 rounded-lg border border-amber-200 bg-amber-50 px-4 py-2.5 text-sm text-amber-800">
          Total belum lunas: <span className="font-semibold">Rp{totalOutstanding.toLocaleString("id-ID")}</span>
          {" · "}
          {debts.length} transaksi
        </div>
      )}

      {error && <p className="mb-2 text-sm text-rose-600">{error}</p>}

      <div className="overflow-x-auto rounded-lg border border-slate-200 bg-white shadow-sm">
        <table className="w-full min-w-[560px] text-sm">
          <thead className="bg-slate-50 text-left text-xs uppercase text-slate-500">
            <tr>
              <th className="px-3 py-2">ID</th>
              <th className="px-3 py-2">Tanggal</th>
              <th className="px-3 py-2">Pelanggan</th>
              <th className="px-3 py-2">Jumlah</th>
              <th className="px-3 py-2"></th>
            </tr>
          </thead>
          <tbody>
            {debts.map((d) => (
              <tr key={d.id} className="border-t border-slate-100">
                <td className="whitespace-nowrap px-3 py-2">#{d.id}</td>
                <td className="whitespace-nowrap px-3 py-2">{new Date(d.created_at).toLocaleString("id-ID")}</td>
                <td className="whitespace-nowrap px-3 py-2 font-medium text-slate-800">{d.customer_name}</td>
                <td className="whitespace-nowrap px-3 py-2">Rp{d.total.toLocaleString("id-ID")}</td>
                <td className="px-2 py-2 text-right">
                  <button
                    onClick={() => markPaid(d.id)}
                    disabled={busyId === d.id}
                    className={`whitespace-nowrap rounded px-2 py-1.5 text-xs font-medium hover:underline disabled:opacity-50 ${
                      confirmId === d.id ? "text-emerald-700" : "text-emerald-600 hover:bg-emerald-50"
                    }`}
                  >
                    {confirmId === d.id ? "Yakin lunas?" : "Tandai lunas"}
                  </button>
                </td>
              </tr>
            ))}
            {!loading && debts.length === 0 && (
              <tr>
                <td colSpan={5} className="px-3 py-6 text-center text-slate-400">
                  Tidak ada hutang yang belum lunas.
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}
