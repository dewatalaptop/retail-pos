import { useState } from "react";
import { Navigate } from "react-router-dom";
import { useAuth } from "../context/AuthContext";

export default function LoginPage() {
  const { user, login, loginWithGoogle } = useAuth();
  const [username, setUsername] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);
  const [googleBusy, setGoogleBusy] = useState(false);

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

  async function handleGoogle() {
    setGoogleBusy(true);
    setError("");
    try {
      await loginWithGoogle();
    } catch (err: any) {
      // Always log the full error — the UI text below is deliberately terse
      // (raw native/Firebase error strings aren't good app copy), but a
      // swallowed error with no trace anywhere makes a real failure
      // impossible to diagnose remotely. Check the browser/WebView console
      // for this if Google sign-in fails.
      console.error("Google sign-in failed:", err);
      // A user-cancelled sign-in isn't an error worth showing as app copy —
      // covers both the native Android dialog's dismissal and any lingering
      // web popup-style cancellation code.
      const message = String(err?.message ?? "");
      if (err?.code === "auth/popup-closed-by-user" || /cancel/i.test(message)) {
        setError("");
      } else {
        setError(`Gagal masuk dengan Google: ${message || err?.code || "kesalahan tidak diketahui"}. Coba lagi.`);
      }
    } finally {
      setGoogleBusy(false);
    }
  }

  return (
    <div className="flex min-h-screen flex-col items-center justify-center gap-4 bg-slate-100 px-4 py-8">
      <div className="w-full max-w-sm rounded-xl bg-white p-8 shadow">
        <h1 className="mb-1 text-xl font-bold text-slate-900">Retail POS</h1>
        <p className="mb-6 text-sm text-slate-500">Aplikasi kasir gratis untuk toko kecil-menengah</p>

        <button
          onClick={handleGoogle}
          disabled={googleBusy}
          className="mb-2 flex w-full items-center justify-center gap-2 rounded-lg border border-slate-300 px-4 py-2.5 text-sm font-medium text-slate-700 hover:bg-slate-50 disabled:cursor-not-allowed disabled:opacity-50"
        >
          <svg width="18" height="18" viewBox="0 0 18 18" aria-hidden="true">
            <path fill="#4285F4" d="M17.64 9.2c0-.64-.06-1.25-.16-1.84H9v3.48h4.84a4.14 4.14 0 0 1-1.8 2.72v2.26h2.9c1.7-1.56 2.68-3.87 2.68-6.62Z" />
            <path fill="#34A853" d="M9 18c2.43 0 4.47-.8 5.96-2.18l-2.9-2.26c-.8.54-1.84.86-3.06.86-2.35 0-4.34-1.59-5.05-3.72H.95v2.33A9 9 0 0 0 9 18Z" />
            <path fill="#FBBC05" d="M3.95 10.7A5.4 5.4 0 0 1 3.67 9c0-.59.1-1.17.28-1.7V4.97H.95A9 9 0 0 0 0 9c0 1.45.35 2.83.95 4.03l3-2.33Z" />
            <path fill="#EA4335" d="M9 3.58c1.32 0 2.51.46 3.44 1.35l2.58-2.58C13.46.89 11.43 0 9 0A9 9 0 0 0 .95 4.97l3 2.33C4.66 5.17 6.65 3.58 9 3.58Z" />
          </svg>
          {googleBusy ? "Membuka..." : "Masuk dengan Google (Pemilik Toko)"}
        </button>
        <p className="mb-6 text-center text-xs text-slate-400">
          Belum punya toko? Login Google pertama otomatis membuatkan toko baru untukmu.
        </p>

        <div className="mb-4 flex items-center gap-3">
          <div className="h-px flex-1 bg-slate-200" />
          <span className="text-xs font-medium uppercase text-slate-400">atau masuk sebagai kasir</span>
          <div className="h-px flex-1 bg-slate-200" />
        </div>

        <form onSubmit={handleSubmit}>
          <label className="mb-1 block text-sm font-medium text-slate-700">Username</label>
          <input
            value={username}
            onChange={(e) => setUsername(e.target.value)}
            className="mb-4 w-full rounded-lg border border-slate-300 px-3 py-2 text-sm outline-none focus:border-[var(--brand-500)]"
          />

          <label className="mb-1 block text-sm font-medium text-slate-700">Password</label>
          <input
            type="password"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            className="mb-4 w-full rounded-lg border border-slate-300 px-3 py-2 text-sm outline-none focus:border-[var(--brand-500)]"
          />

          {error && <p className="mb-3 text-sm text-rose-600">{error}</p>}

          <button
            type="submit"
            disabled={busy}
            className="w-full rounded-lg bg-[var(--brand-600)] px-4 py-2.5 text-sm font-semibold text-white hover:bg-[var(--brand-500)] disabled:opacity-50"
          >
            {busy ? "Masuk..." : "Masuk sebagai kasir"}
          </button>

          <p className="mt-4 text-center text-xs text-slate-400">
            Coba toko demo: admin/admin123 atau kasir/kasir123
          </p>
        </form>
      </div>
    </div>
  );
}
