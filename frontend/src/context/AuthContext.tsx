import { createContext, useContext, useEffect, useState, ReactNode } from "react";
import { getRedirectResult, signInWithRedirect, signOut } from "firebase/auth";
import { Capacitor } from "@capacitor/core";
import { FirebaseAuthentication } from "@capacitor-firebase/authentication";
import { api, getToken, setToken, ApiError } from "../api/client";
import { firebaseAuth, googleProvider } from "../firebase";

export interface AuthPermissions {
  canViewAllTransactions: boolean;
  canViewReports: boolean;
  canManageProducts: boolean;
  canVoidTransactions: boolean;
}

export interface AuthUser {
  userId: number;
  storeId: number;
  username: string | null;
  name: string;
  role: "admin" | "kasir";
  permissions: AuthPermissions;
}

interface AuthContextValue {
  user: AuthUser | null;
  loading: boolean;
  googleError: string | null;
  login: (username: string, password: string) => Promise<void>;
  loginWithGoogle: () => Promise<void>;
  logout: () => void;
}

const AuthContext = createContext<AuthContextValue | undefined>(undefined);

// The Firebase sign-in itself is only ever used to obtain this ID token — the
// app's own session from here on is the same JWT bearer-token scheme used
// everywhere else (see /auth/google in the backend) — so nothing downstream
// needs to know Google (or which platform's sign-in flow) was involved.
async function exchangeForAppSession(idToken: string): Promise<AuthUser> {
  const res = await api<{ token: string; user: AuthUser }>("/auth/google", {
    method: "POST",
    body: JSON.stringify({ idToken }),
  });
  setToken(res.token);
  return res.user;
}

export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<AuthUser | null>(null);
  const [loading, setLoading] = useState(true);
  const [googleError, setGoogleError] = useState<string | null>(null);

  useEffect(() => {
    async function init() {
      // Web-only: this is where the app picks the result back up after
      // loginWithGoogle() below sends the whole page to Google and back —
      // must run before the token check further down, since there's no app
      // JWT yet on this first return trip.
      if (!Capacitor.isNativePlatform()) {
        try {
          const redirectResult = await getRedirectResult(firebaseAuth);
          if (redirectResult) {
            const idToken = await redirectResult.user.getIdToken();
            const loggedInUser = await exchangeForAppSession(idToken);
            setUser(loggedInUser);
            await signOut(firebaseAuth).catch(() => {});
            setLoading(false);
            return;
          }
        } catch (err: any) {
          setGoogleError(err?.message ?? "Gagal masuk dengan Google. Coba lagi.");
        }
      }

      if (!getToken()) {
        setLoading(false);
        return;
      }
      api<{ user: AuthUser }>("/auth/me")
        .then((res) => setUser(res.user))
        .catch(() => setToken(null))
        .finally(() => setLoading(false));
    }
    init();
  }, []);

  async function login(username: string, password: string) {
    const res = await api<{ token: string; user: AuthUser }>("/auth/login", {
      method: "POST",
      body: JSON.stringify({ username, password }),
    });
    setToken(res.token);
    setUser(res.user);
  }

  async function loginWithGoogle() {
    setGoogleError(null);

    if (Capacitor.isNativePlatform()) {
      // Google refuses to load its OAuth consent screen inside ANY embedded
      // WebView (Capacitor's included) as an anti-phishing measure — a
      // popup or redirect here just bounces out to the system browser and
      // never makes it back to a working session, which is exactly the
      // "stuck after login" bug this replaces. The native plugin drives
      // Android's own Google Sign-In UI entirely outside the WebView, then
      // completes native Firebase auth — getIdToken() after that returns a
      // real Firebase ID token, not the raw Google credential.
      await FirebaseAuthentication.signInWithGoogle();
      const { token: idToken } = await FirebaseAuthentication.getIdToken();
      const loggedInUser = await exchangeForAppSession(idToken);
      setUser(loggedInUser);
      await FirebaseAuthentication.signOut().catch(() => {});
      return;
    }

    // Web: a full-page redirect, not a popup. Popups are blocked outright on
    // many mobile browsers and are unreliable anywhere third-party storage
    // is partitioned (Safari ITP, Chrome's evolving defaults) — the
    // intermittent "login sometimes doesn't work" on web this replaces. The
    // result comes back through getRedirectResult() in the effect above,
    // after Google sends the browser back to this same page.
    await signInWithRedirect(firebaseAuth, googleProvider);
  }

  function logout() {
    setToken(null);
    setUser(null);
  }

  return (
    <AuthContext.Provider value={{ user, loading, googleError, login, loginWithGoogle, logout }}>
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth(): AuthContextValue {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error("useAuth must be used within AuthProvider");
  return ctx;
}

export { ApiError };
