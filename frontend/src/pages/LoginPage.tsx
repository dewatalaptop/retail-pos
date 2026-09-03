import { useState } from "react";
import { Navigate } from "react-router-dom";
import { useAuth } from "../context/AuthContext";
import { useSettings } from "../context/SettingsContext";
import AdSlot from "../components/AdSlot";

export default function LoginPage() {
  const { user, login } = useAuth();
  const { settings } = useSettings();
  const [username, setUsername] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);

  if (user) return <Navigate to="/" replace />;

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setBusy(true);
    setError("");
    try {
      await login(username, password);
    } catch (err: any) {
      setError(err.message ?? "Login gagal");
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="flex min-h-screen flex-col items-center justify-center gap-4 bg-slate-100 px-4 py-8">
      <form onSubmit={handleSubmit} className="w-full max-w-sm rounded-xl bg-white p-8 shadow">
        <h1 className="mb-1 text-xl font-bold text-slate-900">{settings.storeName}</h1>
        <p className="mb-6 text-sm text-slate-500">Masuk untuk melanjutkan</p>

        <label className="mb-1 block text-sm font-medium text-slate-700">Username</label>
        <input
          value={username}
          onChange={(e) => setUsername(e.target.value)}
          className="mb-4 w-full rounded-lg border border-slate-300 px-3 py-2 text-sm outline-none focus:border-indigo-500"
          autoFocus
        />

        <label className="mb-1 block text-sm font-medium text-slate-700">Password</label>
        <input
          type="password"
          value={password}
          onChange={(e) => setPassword(e.target.value)}
          className="mb-4 w-full rounded-lg border border-slate-300 px-3 py-2 text-sm outline-none focus:border-indigo-500"
        />

        {error && <p className="mb-3 text-sm text-rose-600">{error}</p>}

        <button
          type="submit"
          disabled={busy}
          className="w-full rounded-lg bg-indigo-600 px-4 py-2 text-sm font-semibold text-white hover:bg-indigo-500 disabled:opacity-50"
        >
          {busy ? "Masuk..." : "Masuk"}
        </button>

        <p className="mt-4 text-center text-xs text-slate-400">
          Demo: admin/admin123 (admin) atau kasir/kasir123 (kasir)
        </p>
      </form>
      <div className="w-full max-w-sm">
        <AdSlot clientId={settings.adsenseClientId} slotId={settings.adsenseSlotLogin} />
      </div>
    </div>
  );
}
