import { createContext, useContext, useEffect, useState, ReactNode } from "react";
import { signInWithPopup, signOut } from "firebase/auth";
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
  login: (username: string, password: string) => Promise<void>;
  loginWithGoogle: () => Promise<void>;
  logout: () => void;
}

const AuthContext = createContext<AuthContextValue | undefined>(undefined);

// Best-effort diagnostic ping so a Google sign-in failure on someone else's
// device (who has no way to relay a console error back) still shows up
// somewhere Claude Code can actually see it — the Cloud Functions logs for
// this backend's own /auth/log-client-error route. Never let this call
// itself surface an error to the user or block the real error handling.
function reportGoogleSignInError(err: any): void {
  api("/auth/log-client-error", {
    method: "POST",
    body: JSON.stringify({
      platform: Capacitor.getPlatform(),
      code: err?.code,
      message: err?.message,
    }),
  }).catch(() => {});
}

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

  useEffect(() => {
    if (!getToken()) {
      setLoading(false);
      return;
    }
    api<{ user: AuthUser }>("/auth/me")
      .then((res) => setUser(res.user))
      .catch(() => setToken(null))
      .finally(() => setLoading(false));
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
    try {
      if (Capacitor.isNativePlatform()) {
        // Google refuses to load its OAuth consent screen inside ANY
        // embedded WebView (Capacitor's included) as an anti-phishing
        // measure — a popup or redirect here just bounces out to the
        // system browser and never makes it back to a working session,
        // which is exactly the "stuck after login" bug this replaces. The
        // native plugin drives Android's own Google Sign-In UI entirely
        // outside the WebView, then completes native Firebase auth —
        // getIdToken() after that returns a real Firebase ID token, not
        // the raw Google credential.
        //
        // Try the modern Credential Manager path first (the plugin's
        // default), but fall back to the legacy GoogleSignInClient API on
        // any failure — Credential Manager has a well-documented bug where
        // it throws "[16] Account reauth failed" specifically on a
        // device's FIRST sign-in with this app (no previously saved
        // credential to "reauth" yet), which is every new store owner's
        // very first experience with the app, confirmed via a real device
        // (2026-09-04). The legacy API doesn't have this precondition —
        // it always shows a plain account picker regardless of prior state.
        try {
          await FirebaseAuthentication.signInWithGoogle({ useCredentialManager: true });
        } catch {
          await FirebaseAuthentication.signInWithGoogle({ useCredentialManager: false });
        }
        const { token: idToken } = await FirebaseAuthentication.getIdToken();
        const loggedInUser = await exchangeForAppSession(idToken);
        setUser(loggedInUser);
        await FirebaseAuthentication.signOut().catch(() => {});
        return;
      }

      // Web: a popup, not a redirect. signInWithRedirect was tried and
      // reverted (2026-09-04) — its round trip has to correlate pending
      // state via storage shared between this app's origin and Firebase's
      // authDomain, which counts as third-party access from this app's
      // point of view and gets silently blocked by an increasing number of
      // browsers' storage-partitioning defaults: the redirect completes,
      // but getRedirectResult() comes back null instead of the signed-in
      // user, with nothing to catch or show — confirmed via direct user
      // report as the actual failure mode, not a hypothetical. A popup
      // avoids that specific failure entirely (it talks back to the opener
      // window directly while still open, no cross-navigation storage
      // correlation involved) — its own known failure mode is popup
      // blockers, which at least fail loudly (a catchable error) rather
      // than silently.
      const result = await signInWithPopup(firebaseAuth, googleProvider);
      const idToken = await result.user.getIdToken();
      const loggedInUser = await exchangeForAppSession(idToken);
      setUser(loggedInUser);
      await signOut(firebaseAuth).catch(() => {});
    } catch (err) {
      reportGoogleSignInError(err);
      throw err;
    }
  }

  function logout() {
    setToken(null);
    setUser(null);
  }

  return (
    <AuthContext.Provider value={{ user, loading, login, loginWithGoogle, logout }}>
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
