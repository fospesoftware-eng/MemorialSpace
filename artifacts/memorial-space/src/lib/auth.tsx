/**
 * Frontend auth provider. Talks to the api-server `/api/auth/*` endpoints
 * over a session cookie (no tokens stored in JS — that keeps us out of the
 * XSS-token-theft blast radius).
 *
 * Usage:
 *   const { user, signIn, signOut, loading } = useAuth();
 */
import { createContext, useCallback, useContext, useEffect, useState, type ReactNode } from "react";

const API_BASE = `${import.meta.env.BASE_URL.replace(/\/$/, "")}/api`;

export type SessionKind = "cemetery" | "family" | "admin" | "vendor";

export interface SessionUser {
  kind: SessionKind;
  userId?: number;
  adminId?: number;
  vendorId?: number;
  organizationId?: number;
  email: string;
  name: string;
  role: string;
}

interface AuthContextValue {
  user: SessionUser | null;
  loading: boolean;
  /** Returns the recommended redirect path on success. Throws on failure with a clean message. */
  signIn: (kind: SessionKind, email: string, password: string) => Promise<string>;
  signOut: () => Promise<void>;
  refresh: () => Promise<void>;
}

const AuthContext = createContext<AuthContextValue | null>(null);

async function api<T>(path: string, init?: RequestInit): Promise<T> {
  const res = await fetch(`${API_BASE}${path}`, {
    ...(init ?? {}),
    credentials: "include",
    headers: {
      "content-type": "application/json",
      ...(init?.headers ?? {}),
    },
  });
  const text = await res.text();
  let body: unknown = undefined;
  try { body = text ? JSON.parse(text) : undefined; } catch { body = text; }
  if (!res.ok) {
    const msg = (body && typeof body === "object" && "error" in body && typeof (body as { error: unknown }).error === "string")
      ? (body as { error: string }).error
      : `Request failed (${res.status})`;
    throw new Error(msg);
  }
  return body as T;
}

export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<SessionUser | null>(null);
  const [loading, setLoading] = useState(true);

  const refresh = useCallback(async () => {
    try {
      const data = await api<{ user: SessionUser }>("/auth/me");
      setUser(data.user);
    } catch {
      setUser(null);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { void refresh(); }, [refresh]);

  const signIn = useCallback(async (kind: SessionKind, email: string, password: string): Promise<string> => {
    const data = await api<{ user: SessionUser; redirectTo: string }>("/auth/login", {
      method: "POST",
      body: JSON.stringify({ kind, email, password }),
    });
    setUser(data.user);
    return data.redirectTo;
  }, []);

  const signOut = useCallback(async () => {
    try { await api("/auth/logout", { method: "POST" }); } catch { /* ignore */ }
    setUser(null);
  }, []);

  return (
    <AuthContext.Provider value={{ user, loading, signIn, signOut, refresh }}>
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth(): AuthContextValue {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error("useAuth must be used within <AuthProvider>");
  return ctx;
}

/**
 * Lightweight route guard. Wrap a routed branch with the `kinds` of session
 * allowed; if the visitor isn't signed in (or has the wrong tier) they are
 * sent to the appropriate sign-in page. While the initial /me check is in
 * flight we render a soft loading state instead of flashing protected UI.
 */
export function RequireAuth({
  kinds,
  signInPath,
  children,
}: {
  kinds: SessionKind[];
  signInPath: string;
  children: ReactNode;
}) {
  const { user, loading } = useAuth();
  if (loading) {
    return (
      <div className="min-h-screen w-full flex items-center justify-center bg-background text-muted-foreground text-sm">
        Loading…
      </div>
    );
  }
  if (!user || !kinds.includes(user.kind)) {
    if (typeof window !== "undefined") {
      window.location.replace(signInPath);
    }
    return null;
  }
  return <>{children}</>;
}
