import { createContext, useContext, useEffect, useState, ReactNode } from "react";
import { signInWithPopup, signOut } from "firebase/auth";
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
    const result = await signInWithPopup(firebaseAuth, googleProvider);
    const idToken = await result.user.getIdToken();
    // The Firebase sign-in itself is only used to obtain this ID token — the
    // app's own session from here on is the same JWT bearer-token scheme
    // used everywhere else (see /auth/google in the backend), so nothing
    // downstream needs to know Google was involved at all.
    const res = await api<{ token: string; user: AuthUser }>("/auth/google", {
      method: "POST",
      body: JSON.stringify({ idToken }),
    });
    setToken(res.token);
    setUser(res.user);
    await signOut(firebaseAuth).catch(() => {});
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
