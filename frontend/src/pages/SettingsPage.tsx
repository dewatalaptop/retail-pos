import { useEffect, useRef, useState } from "react";
import { api, ApiError } from "../api/client";
import { useSettings } from "../context/SettingsContext";
import { usePrinter } from "../context/PrinterContext";
import { useStoreLogo } from "../hooks/useStoreLogo";
import { THEMES } from "../lib/themes";
import { PAPER_WIDTHS, type PaperWidthKey } from "../lib/escpos";

type BusinessMode = "toko" | "warung" | "restoran";

interface FullSettings {
  storeName: string;
  storeAddress: string;
  storePhone: string;
  receiptFooter: string;
  theme: string;
  defaultTaxRatePercent: number;
  businessMode: BusinessMode;
  defaultServiceChargePercent: number;
}

const EMPTY: FullSettings = {
  storeName: "",
  storeAddress: "",
  storePhone: "",
  receiptFooter: "",
  theme: "indigo",
  defaultTaxRatePercent: 0,
  businessMode: "toko",
  defaultServiceChargePercent: 0,
};

const BUSINESS_MODES: { key: BusinessMode; label: string; description: string; icon: string }[] = [
  { key: "toko", label: "Toko", icon: "🏬", description: "Kasir langsung — scan/pilih produk, bayar, selesai." },
  { key: "warung", label: "Warung", icon: "🏠", description: "Seperti Toko, plus metode bayar Hutang/Kasbon untuk pelanggan langganan." },
  { key: "restoran", label: "Restoran", icon: "🍽️", description: "Nomor meja, tipe pesanan, catatan per item, dan biaya layanan." },
];

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
        className="w-full rounded-lg border border-slate-300 px-3 py-2.5 text-sm outline-none focus:border-[var(--brand-500)]"
      />
      {hint && <p className="mt-1 text-xs text-slate-400">{hint}</p>}
    </div>
  );
}

function LogoCard() {
  const { logoUrl, setLogo, clearLogo } = useStoreLogo();
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const fileInputRef = useRef<HTMLInputElement>(null);

  async function handleFile(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    e.target.value = ""; // allow re-selecting the same file later
    if (!file) return;
    if (!file.type.startsWith("image/")) {
      setError("File harus berupa gambar");
      return;
    }
    setBusy(true);
    setError("");
    try {
      await setLogo(file);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Gagal menyimpan logo");
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="rounded-lg border border-slate-200 bg-white p-4 shadow-sm">
      <h2 className="mb-1 font-semibold text-slate-800">Logo usaha</h2>
      <p className="mb-4 text-sm text-slate-500">
        Tampil di bagian atas menu &amp; struk. Logo ini disimpan langsung di perangkat/browser ini
        (tidak dikirim ke server) — kalau kasir masuk dari HP atau komputer lain, logo perlu diunggah
        ulang di perangkat itu.
      </p>
      <div className="flex items-center gap-4">
        <div className="flex h-16 w-16 shrink-0 items-center justify-center overflow-hidden rounded-lg border border-dashed border-slate-300 bg-slate-50">
          {logoUrl ? (
            <img src={logoUrl} alt="Logo" className="h-full w-full object-contain" />
          ) : (
            <span className="text-center text-[10px] text-slate-400">Belum ada logo</span>
          )}
        </div>
        <div className="flex flex-col gap-2 sm:flex-row">
          <button
            type="button"
            onClick={() => fileInputRef.current?.click()}
            disabled={busy}
            className="rounded-lg border border-slate-300 px-3 py-2 text-sm font-medium text-slate-600 hover:border-[var(--brand-400)] disabled:opacity-50"
          >
            {busy ? "Menyimpan..." : logoUrl ? "Ganti logo" : "Unggah logo"}
          </button>
          {logoUrl && (
            <button
              type="button"
              onClick={clearLogo}
              className="rounded-lg border border-slate-300 px-3 py-2 text-sm font-medium text-rose-500 hover:bg-rose-50"
            >
              Hapus
            </button>
          )}
        </div>
        <input ref={fileInputRef} type="file" accept="image/*" onChange={handleFile} className="hidden" />
      </div>
      {error && <p className="mt-2 text-sm text-rose-600">{error}</p>}
    </div>
  );
}

const STATUS_META: Record<string, { label: string; dot: string }> = {
  disconnected: { label: "Belum terhubung", dot: "bg-slate-300" },
  scanning: { label: "Mencari printer...", dot: "bg-amber-400 animate-pulse" },
  connecting: { label: "Menghubungkan...", dot: "bg-amber-400 animate-pulse" },
  connected: { label: "Terhubung", dot: "bg-emerald-500" },
  printing: { label: "Mencetak...", dot: "bg-emerald-500 animate-pulse" },
  error: { label: "Gagal", dot: "bg-rose-500" },
};

function PrinterCard() {
  const printer = usePrinter();
  const [testError, setTestError] = useState("");
  const [testBusy, setTestBusy] = useState(false);
  const meta = STATUS_META[printer.status];

  async function handleTestPrint() {
    setTestBusy(true);
    setTestError("");
    try {
      await printer.printReceipt(
        {
          transactionId: 0,
          items: [{ name: "Contoh Produk", qty: 1, price: 15000, discountPercent: 0 }],
          subtotal: 15000,
          discountTotal: 0,
          taxTotal: 0,
          total: 15000,
          paymentMethod: "tunai",
          cashReceived: 15000,
          changeDue: 0,
          createdAt: new Date().toISOString(),
        },
        { storeName: "Tes Cetak", footerNote: "Kalau struk ini tercetak rapi, printer sudah siap dipakai." }
      );
    } catch (err) {
      setTestError(err instanceof Error ? err.message : "Gagal mencetak");
    } finally {
      setTestBusy(false);
    }
  }

  return (
    <div className="rounded-lg border border-slate-200 bg-white p-4 shadow-sm">
      <h2 className="mb-1 font-semibold text-slate-800">Printer struk (Bluetooth)</h2>
      <p className="mb-4 text-sm text-slate-500">
        Sambungkan printer thermal Bluetooth untuk mencetak struk langsung, tanpa lewat dialog cetak
        browser. Koneksi ini tersimpan di perangkat ini saja — kalau kasir memakai HP/tablet lain,
        printer perlu dihubungkan ulang di perangkat itu.
        {!printer.isNative && " Fitur ini paling stabil dipakai lewat aplikasi Android, bukan browser."}
      </p>

      <div className="mb-4 flex items-center gap-2">
        <span className={`h-2.5 w-2.5 rounded-full ${meta.dot}`} />
        <span className="text-sm font-medium text-slate-700">
          {meta.label}
          {printer.connectedName && printer.status === "connected" ? ` — ${printer.connectedName}` : ""}
        </span>
      </div>

      {printer.error && <p className="mb-3 text-sm text-rose-600">{printer.error}</p>}

      {printer.status === "connected" || printer.status === "printing" ? (
        <div className="flex flex-col gap-4">
          <div>
            <label className="mb-1.5 block text-sm font-medium text-slate-700">Ukuran kertas</label>
            <div className="flex gap-2">
              {(Object.keys(PAPER_WIDTHS) as PaperWidthKey[]).map((key) => (
                <button
                  key={key}
                  type="button"
                  onClick={() => printer.setPaperWidth(key)}
                  className={`rounded-lg border px-3 py-2 text-sm font-medium ${
                    printer.paperWidth === key ? "border-slate-800 bg-slate-50" : "border-slate-200 text-slate-600"
                  }`}
                >
                  {PAPER_WIDTHS[key].label}
                </button>
              ))}
            </div>
          </div>

          <label className="flex items-center gap-2 text-sm text-slate-700">
            <input
              type="checkbox"
              checked={printer.autoPrint}
              onChange={(e) => printer.setAutoPrint(e.target.checked)}
              className="h-4 w-4 rounded border-slate-300"
            />
            Cetak otomatis setiap transaksi selesai
          </label>

          <div className="flex flex-wrap gap-2">
            <button
              type="button"
              onClick={handleTestPrint}
              disabled={testBusy || printer.status === "printing"}
              className="rounded-lg bg-slate-800 px-4 py-2 text-sm font-medium text-white hover:bg-slate-700 disabled:opacity-50"
            >
              {testBusy ? "Mencetak..." : "Tes cetak"}
            </button>
            <button
              type="button"
              onClick={() => printer.disconnect()}
              className="rounded-lg border border-slate-300 px-4 py-2 text-sm font-medium text-rose-500 hover:bg-rose-50"
            >
              Putuskan printer
            </button>
          </div>
          {testError && <p className="text-sm text-rose-600">{testError}</p>}
        </div>
      ) : (
        <div className="flex flex-col gap-3">
          <button
            type="button"
            onClick={() => (printer.status === "scanning" ? printer.stopScan() : printer.scan())}
            className="w-fit rounded-lg bg-[var(--brand-600)] px-4 py-2 text-sm font-medium text-white hover:bg-[var(--brand-500)]"
          >
            {printer.status === "scanning" ? "Hentikan pencarian" : "Cari printer"}
          </button>

          {printer.status === "scanning" && printer.devices.length === 0 && (
            <p className="text-sm text-slate-400">Menyalakan printer dan mengaktifkan mode pairing membantu ditemukan lebih cepat...</p>
          )}

          {printer.devices.length > 0 && (
            <div className="flex flex-col gap-1.5">
              {printer.devices.map((d) => (
                <button
                  key={d.deviceId}
                  type="button"
                  onClick={() => printer.connect(d)}
                  className="flex items-center justify-between rounded-lg border border-slate-200 px-3 py-2 text-left text-sm hover:border-[var(--brand-400)]"
                >
                  <span className="font-medium text-slate-700">{d.name}</span>
                  <span className="text-xs text-[var(--brand-600)]">Hubungkan</span>
                </button>
              ))}
            </div>
          )}
        </div>
      )}
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
        <h2 className="mb-1 font-semibold text-slate-800">Jenis usaha</h2>
        <p className="mb-4 text-sm text-slate-500">
          Menentukan fitur apa yang muncul di halaman Kasir — pilih yang paling cocok dengan cara
          usaha Anda berjalan. Bisa diganti kapan saja.
        </p>
        <div className="grid grid-cols-1 gap-2 sm:grid-cols-3">
          {BUSINESS_MODES.map((mode) => (
            <button
              key={mode.key}
              type="button"
              onClick={() => set("businessMode", mode.key)}
              className={`flex flex-col items-start gap-1 rounded-lg border p-3 text-left ${
                form.businessMode === mode.key
                  ? "border-[var(--brand-500)] bg-[var(--brand-50)]"
                  : "border-slate-200 hover:border-slate-300"
              }`}
            >
              <span className="text-lg" aria-hidden="true">{mode.icon}</span>
              <span className="text-sm font-semibold text-slate-800">{mode.label}</span>
              <span className="text-xs text-slate-500">{mode.description}</span>
            </button>
          ))}
        </div>
      </div>

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

      <div className="rounded-lg border border-slate-200 bg-white p-4 shadow-sm">
        <h2 className="mb-1 font-semibold text-slate-800">Pajak &amp; layanan</h2>
        <p className="mb-4 text-sm text-slate-500">
          Tarif ini otomatis terisi di setiap transaksi baru di halaman Kasir, jadi kasir tidak perlu
          mengetiknya satu per satu — masih bisa diubah manual per transaksi kalau perlu (mis. pajak
          restoran/PB1, atau service charge).
        </p>
        <div className="flex flex-wrap gap-4">
          <div className="max-w-xs">
            <label className="mb-1 block text-sm font-medium text-slate-700">Tarif pajak default (%)</label>
            <input
              type="number"
              min={0}
              max={100}
              step={0.1}
              value={form.defaultTaxRatePercent}
              onChange={(e) => set("defaultTaxRatePercent", Math.min(100, Math.max(0, Number(e.target.value))))}
              className="w-full rounded-lg border border-slate-300 px-3 py-2.5 text-sm outline-none focus:border-[var(--brand-500)]"
            />
          </div>
          {form.businessMode === "restoran" && (
            <div className="max-w-xs">
              <label className="mb-1 block text-sm font-medium text-slate-700">Biaya layanan default (%)</label>
              <input
                type="number"
                min={0}
                max={100}
                step={0.1}
                value={form.defaultServiceChargePercent}
                onChange={(e) => set("defaultServiceChargePercent", Math.min(100, Math.max(0, Number(e.target.value))))}
                className="w-full rounded-lg border border-slate-300 px-3 py-2.5 text-sm outline-none focus:border-[var(--brand-500)]"
              />
            </div>
          )}
        </div>
      </div>

      <div className="rounded-lg border border-slate-200 bg-white p-4 shadow-sm">
        <h2 className="mb-1 font-semibold text-slate-800">Tema warna</h2>
        <p className="mb-4 text-sm text-slate-500">Warna aksen tombol &amp; navigasi di seluruh aplikasi.</p>
        <div className="flex flex-wrap gap-2">
          {THEMES.map((t) => (
            <button
              key={t.name}
              type="button"
              onClick={() => set("theme", t.name)}
              className={`flex items-center gap-2 rounded-lg border px-3 py-2 text-sm font-medium ${
                form.theme === t.name ? "border-slate-800 bg-slate-50" : "border-slate-200 text-slate-600"
              }`}
            >
              <span className="h-4 w-4 rounded-full" style={{ backgroundColor: t.swatch }} />
              {t.label}
            </button>
          ))}
        </div>
      </div>

      <LogoCard />

      <PrinterCard />

      {error && <p className="text-sm text-rose-600">{error}</p>}

      <div className="sticky bottom-0 -mx-4 flex items-center gap-3 border-t border-slate-200 bg-slate-100/95 px-4 py-3 backdrop-blur sm:static sm:mx-0 sm:border-0 sm:bg-transparent sm:p-0 sm:backdrop-blur-none">
        <button
          onClick={save}
          disabled={saving}
          className="w-full rounded-lg bg-[var(--brand-600)] px-4 py-2.5 text-sm font-semibold text-white hover:bg-[var(--brand-500)] disabled:cursor-not-allowed disabled:opacity-50 sm:w-auto"
        >
          {saving ? "Menyimpan..." : "Simpan pengaturan"}
        </button>
        {saved && <span className="text-sm text-emerald-600">Tersimpan.</span>}
      </div>
    </div>
  );
}
