const TOKEN_KEY = "retail-pos-token";

export function getToken(): string | null {
  return localStorage.getItem(TOKEN_KEY);
}

export function setToken(token: string | null): void {
  if (token) localStorage.setItem(TOKEN_KEY, token);
  else localStorage.removeItem(TOKEN_KEY);
}

export class ApiError extends Error {
  status: number;
  constructor(message: string, status: number) {
    super(message);
    this.status = status;
  }
}

export async function api<T>(path: string, options: RequestInit = {}): Promise<T> {
  const token = getToken();
  const res = await fetch(`/api${path}`, {
    ...options,
    headers: {
      "Content-Type": "application/json",
      ...(token ? { Authorization: `Bearer ${token}` } : {}),
      ...options.headers,
    },
  });

  if (res.status === 204) return undefined as T;

  const data = await res.json().catch(() => ({}));
  if (!res.ok) {
    // Session expired or invalid: clear the stale token and force back to
    // login instead of leaving the user stuck looking at raw error text on
    // whatever page they were on. Skip this for the login call itself, where
    // a 401 just means "wrong password" and the user is already there.
    if (res.status === 401 && path !== "/auth/login") {
      setToken(null);
      window.location.href = "/login";
    }
    throw new ApiError(data.error ?? `Request gagal (${res.status})`, res.status);
  }
  return data as T;
}
