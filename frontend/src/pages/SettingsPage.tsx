import { useEffect, useState } from "react";
import { api, ApiError } from "../api/client";
import { useSettings } from "../context/SettingsContext";

interface FullSettings {
  storeName: string;
  storeAddress: string;
  storePhone: string;
  receiptFooter: string;
}

const EMPTY: FullSettings = {
  storeName: "",
  storeAddress: "",
  storePhone: "",
  receiptFooter: "",
};

function Field({
  label,
  value,
  onChange,
  hint,
  placeholder,
}: {
  label: string;
  value: string;
  onChange: (v: string) => void;
  hint?: string;
  placeholder?: string;
}) {
  return (
    <div>
      <label className="mb-1 block text-sm font-medium text-slate-700">{label}</label>
      <input
        value={value}
        onChange={(e) => onChange(e.target.value)}
        placeholder={placeholder}
        className="w-full rounded-lg border border-slate-300 px-3 py-2.5 text-sm outline-none focus:border-indigo-500"
      />
      {hint && <p className="mt-1 text-xs text-slate-400">{hint}</p>}
    </div>
  );
}

export default function SettingsPage() {
  const { refresh } = useSettings();
  const [form, setForm] = useState<FullSettings>(EMPTY);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState(false);
  const [error, setError] = useState("");

  useEffect(() => {
    api<FullSettings>("/settings")
      .then(setForm)
      .finally(() => setLoading(false));
  }, []);

  function set<K extends keyof FullSettings>(key: K, value: FullSettings[K]) {
    setForm((prev) => ({ ...prev, [key]: value }));
    setSaved(false);
  }

  async function save() {
    setSaving(true);
    setError("");
    try {
      await api("/settings", { method: "PUT", body: JSON.stringify(form) });
      setSaved(true);
      refresh();
    } catch (err) {
      setError(err instanceof ApiError ? err.message : "Gagal menyimpan pengaturan");
    } finally {
      setSaving(false);
    }
  }

  if (loading) return <p className="text-sm text-slate-400">Memuat...</p>;

  return (
    <div className="mx-auto flex max-w-2xl flex-col gap-4">
      <div className="rounded-lg border border-slate-200 bg-white p-4 shadow-sm">
        <h2 className="mb-1 font-semibold text-slate-800">Profil toko</h2>
        <p className="mb-4 text-sm text-slate-500">
          Muncul di struk transaksi dan di judul aplikasi.
        </p>
        <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
          <Field label="Nama toko" value={form.storeName} onChange={(v) => set("storeName", v)} />
          <Field label="Telepon" value={form.storePhone} onChange={(v) => set("storePhone", v)} />
          <div className="sm:col-span-2">
            <Field label="Alamat" value={form.storeAddress} onChange={(v) => set("storeAddress", v)} />
          </div>
          <div className="sm:col-span-2">
            <Field
              label="Catatan kaki struk"
              value={form.receiptFooter}
              onChange={(v) => set("receiptFooter", v)}
              placeholder="Terima kasih telah berbelanja!"
            />
          </div>
        </div>
      </div>

      {error && <p className="text-sm text-rose-600">{error}</p>}

      <div className="sticky bottom-0 -mx-4 flex items-center gap-3 border-t border-slate-200 bg-slate-100/95 px-4 py-3 backdrop-blur sm:static sm:mx-0 sm:border-0 sm:bg-transparent sm:p-0 sm:backdrop-blur-none">
        <button
          onClick={save}
          disabled={saving}
          className="w-full rounded-lg bg-indigo-600 px-4 py-2.5 text-sm font-semibold text-white hover:bg-indigo-500 disabled:cursor-not-allowed disabled:opacity-50 sm:w-auto"
        >
          {saving ? "Menyimpan..." : "Simpan pengaturan"}
        </button>
        {saved && <span className="text-sm text-emerald-600">Tersimpan.</span>}
      </div>
    </div>
  );
}
