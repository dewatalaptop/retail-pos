import { useEffect, useState } from "react";
import { api, ApiError } from "../api/client";

interface Permissions {
  canViewAllTransactions: boolean;
  canViewReports: boolean;
  canManageProducts: boolean;
  canVoidTransactions: boolean;
}

interface Cashier {
  id: number;
  username: string;
  name: string;
  active: boolean;
  permissions: Permissions;
  createdAt: string;
}

const PERMISSION_LABELS: Record<keyof Permissions, { label: string; hint: string }> = {
  canViewAllTransactions: {
    label: "Lihat semua transaksi",
    hint: "Bukan cuma transaksi miliknya sendiri",
  },
  canViewReports: { label: "Lihat laporan", hint: "Halaman Laporan (pendapatan, produk terlaris, dst.)" },
  canManageProducts: { label: "Kelola produk", hint: "Tambah/edit/hapus produk & stok" },
  canVoidTransactions: { label: "Batalkan transaksi", hint: "Void transaksi yang sudah selesai" },
};

const EMPTY_PERMISSIONS: Permissions = {
  canViewAllTransactions: false,
  canViewReports: false,
  canManageProducts: false,
  canVoidTransactions: false,
};

function PermissionToggles({
  value,
  onChange,
}: {
  value: Permissions;
  onChange: (next: Permissions) => void;
}) {
  return (
    <div className="grid grid-cols-1 gap-2 sm:grid-cols-2">
      {(Object.keys(PERMISSION_LABELS) as Array<keyof Permissions>).map((key) => (
        <label key={key} className="flex items-start gap-2 rounded-lg border border-slate-200 p-2 text-sm">
          <input
            type="checkbox"
            checked={value[key]}
            onChange={(e) => onChange({ ...value, [key]: e.target.checked })}
            className="mt-0.5"
          />
          <span>
            <span className="block font-medium text-slate-700">{PERMISSION_LABELS[key].label}</span>
            <span className="block text-xs text-slate-400">{PERMISSION_LABELS[key].hint}</span>
          </span>
        </label>
      ))}
    </div>
  );
}

export default function CashiersPage() {
  const [cashiers, setCashiers] = useState<Cashier[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  const [username, setUsername] = useState("");
  const [password, setPassword] = useState("");
  const [name, setName] = useState("");
  const [permissions, setPermissions] = useState<Permissions>(EMPTY_PERMISSIONS);
  const [creating, setCreating] = useState(false);

  const [editingId, setEditingId] = useState<number | null>(null);
  const [resetPassword, setResetPassword] = useState("");

  useEffect(() => {
    load();
  }, []);

  async function load() {
    setLoading(true);
    try {
      const res = await api<{ cashiers: Cashier[] }>("/cashiers");
      setCashiers(res.cashiers);
    } finally {
      setLoading(false);
    }
  }

  async function createCashier(e: React.FormEvent) {
    e.preventDefault();
    setCreating(true);
    setError("");
    try {
      await api("/cashiers", {
        method: "POST",
        body: JSON.stringify({ username, password, name, permissions }),
      });
      setUsername("");
      setPassword("");
      setName("");
      setPermissions(EMPTY_PERMISSIONS);
      load();
    } catch (err) {
      setError(err instanceof ApiError ? err.message : "Gagal menambah kasir");
    } finally {
      setCreating(false);
    }
  }

  async function updatePermissions(cashier: Cashier, next: Permissions) {
    setCashiers((prev) => prev.map((c) => (c.id === cashier.id ? { ...c, permissions: next } : c)));
    try {
      await api(`/cashiers/${cashier.id}`, { method: "PUT", body: JSON.stringify({ permissions: next }) });
    } catch (err) {
      setError(err instanceof ApiError ? err.message : "Gagal menyimpan izin akses");
      load();
    }
  }

  async function toggleActive(cashier: Cashier) {
    try {
      await api(`/cashiers/${cashier.id}`, { method: "PUT", body: JSON.stringify({ active: !cashier.active }) });
      load();
    } catch (err) {
      setError(err instanceof ApiError ? err.message : "Gagal mengubah status kasir");
    }
  }

  async function submitResetPassword(cashierId: number) {
    if (!resetPassword) return;
    try {
      await api(`/cashiers/${cashierId}`, { method: "PUT", body: JSON.stringify({ password: resetPassword }) });
      setEditingId(null);
      setResetPassword("");
    } catch (err) {
      setError(err instanceof ApiError ? err.message : "Gagal mengubah password");
    }
  }

  return (
    <div className="flex flex-col gap-4">
      <div className="rounded-lg border border-slate-200 bg-white p-4 shadow-sm">
        <h2 className="mb-1 font-semibold text-slate-800">Tambah kasir</h2>
        <p className="mb-4 text-sm text-slate-500">
          Kasir masuk dengan username & password yang kamu buat di sini — bukan akun Google.
        </p>
        <form onSubmit={createCashier} className="flex flex-col gap-3">
          <div className="grid grid-cols-1 gap-3 sm:grid-cols-3">
            <input
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="Nama"
              required
              className="rounded-lg border border-slate-300 px-3 py-2 text-sm"
            />
            <input
              value={username}
              onChange={(e) => setUsername(e.target.value)}
              placeholder="Username"
              required
              minLength={3}
              className="rounded-lg border border-slate-300 px-3 py-2 text-sm"
            />
            <input
              type="password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              placeholder="Password (min. 6 karakter)"
              required
              minLength={6}
              className="rounded-lg border border-slate-300 px-3 py-2 text-sm"
            />
          </div>
          <div>
            <p className="mb-2 text-xs font-semibold uppercase text-slate-500">Izin akses</p>
            <PermissionToggles value={permissions} onChange={setPermissions} />
          </div>
          {error && <p className="text-sm text-rose-600">{error}</p>}
          <button
            type="submit"
            disabled={creating}
            className="w-fit rounded-lg bg-indigo-600 px-4 py-2 text-sm font-semibold text-white hover:bg-indigo-500 disabled:cursor-not-allowed disabled:opacity-50"
          >
            {creating ? "Menambahkan..." : "Tambah kasir"}
          </button>
        </form>
      </div>

      <div className="flex flex-col gap-3">
        {loading && <p className="text-sm text-slate-400">Memuat...</p>}
        {!loading && cashiers.length === 0 && (
          <p className="rounded-lg border border-dashed border-slate-300 bg-white p-4 text-center text-sm text-slate-400">
            Belum ada kasir. Tambahkan lewat form di atas.
          </p>
        )}
        {cashiers.map((c) => (
          <div key={c.id} className="rounded-lg border border-slate-200 bg-white p-4 shadow-sm">
            <div className="mb-3 flex items-center justify-between">
              <div>
                <p className="font-medium text-slate-800">
                  {c.name} <span className="font-normal text-slate-400">@{c.username}</span>
                </p>
                <p className="text-xs text-slate-400">
                  {c.active ? (
                    <span className="text-emerald-600">Aktif</span>
                  ) : (
                    <span className="text-rose-500">Nonaktif — tidak bisa login</span>
                  )}
                </p>
              </div>
              <div className="flex gap-2">
                <button
                  onClick={() => {
                    setEditingId(editingId === c.id ? null : c.id);
                    setResetPassword("");
                  }}
                  className="text-xs text-indigo-600 hover:underline"
                >
                  Ganti password
                </button>
                <button
                  onClick={() => toggleActive(c)}
                  className={`text-xs font-medium hover:underline ${c.active ? "text-rose-500" : "text-emerald-600"}`}
                >
                  {c.active ? "Nonaktifkan" : "Aktifkan"}
                </button>
              </div>
            </div>

            {editingId === c.id && (
              <div className="mb-3 flex gap-2">
                <input
                  type="password"
                  value={resetPassword}
                  onChange={(e) => setResetPassword(e.target.value)}
                  placeholder="Password baru (min. 6 karakter)"
                  minLength={6}
                  className="flex-1 rounded-lg border border-slate-300 px-3 py-1.5 text-sm"
                />
                <button
                  onClick={() => submitResetPassword(c.id)}
                  className="rounded-lg bg-indigo-600 px-3 py-1.5 text-xs font-medium text-white"
                >
                  Simpan
                </button>
              </div>
            )}

            <PermissionToggles value={c.permissions} onChange={(next) => updatePermissions(c, next)} />
          </div>
        ))}
      </div>
    </div>
  );
}
