"use client";

import { useEffect, useRef, useState } from "react";
import { AuthPortal } from "@/components/auth-portal";
import { OperationsDashboard } from "@/components/operations-dashboard";
import {
  getBackendHealth,
  getCurrentSession,
  getOperationsSnapshot,
  logoutCurrentSession,
} from "@/lib/backend";
import type { AuthSession, BackendHealth, DashboardSnapshot } from "@/lib/operations-types";

const SESSION_STORAGE_KEY = "moto_ops_session";
export type AppWorkspace =
  | "home"
  | "tickets"
  | "ingestion"
  | "movement"
  | "merit"
  | "inventory";

function healthPlaceholder(): BackendHealth {
  return {
    ok: false,
    service: "DLC Service API",
    environment: "loading",
    baseUrl: "loading",
  };
}

function sessionsEqual(left: AuthSession | null, right: AuthSession | null) {
  if (left === right) {
    return true;
  }
  if (!left || !right) {
    return false;
  }
  return (
    left.token === right.token &&
    left.expiresAt === right.expiresAt &&
    left.user.id === right.user.id &&
    left.user.email === right.user.email &&
    left.user.displayName === right.user.displayName &&
    left.user.role === right.user.role &&
    left.permissions.join("|") === right.permissions.join("|")
  );
}

export function OperationsApp({ workspace = "home" }: { workspace?: AppWorkspace }) {
  const [session, setSession] = useState<AuthSession | null>(null);
  const [snapshot, setSnapshot] = useState<DashboardSnapshot | null>(null);
  const [health, setHealth] = useState<BackendHealth>(healthPlaceholder);
  const [loading, setLoading] = useState(true);
  const shouldVerifySessionRef = useRef(false);
  const sessionToken = session?.token ?? null;

  useEffect(() => {
    Promise.resolve().then(() => {
        const rawSession = window.localStorage.getItem(SESSION_STORAGE_KEY);
        if (rawSession) {
          try {
            setSession(JSON.parse(rawSession) as AuthSession);
            shouldVerifySessionRef.current = true;
            return;
          } catch {
            window.localStorage.removeItem(SESSION_STORAGE_KEY);
          }
      }
      setLoading(false);
    });
  }, []);

  useEffect(() => {
    let active = true;

    void getBackendHealth()
      .then((nextHealth) => {
        if (!active) {
          return;
        }
        setHealth(nextHealth);
      })
      .catch(() => {
        if (!active) {
          return;
        }
        setHealth((current) => ({
          ...current,
          environment: current.environment === "loading" ? "unknown" : current.environment,
        }));
      });

    return () => {
      active = false;
    };
  }, []);

  useEffect(() => {
    if (!sessionToken || !session) {
      return;
    }

    let active = true;

    Promise.resolve()
      .then(async () => {
        const nextSession = shouldVerifySessionRef.current
          ? await getCurrentSession(session).catch(() => session)
          : session;
        const nextSnapshot = await getOperationsSnapshot(nextSession);
        if (!active) {
          return;
        }
        window.localStorage.setItem(SESSION_STORAGE_KEY, JSON.stringify(nextSession));
        if (!sessionsEqual(session, nextSession)) {
          setSession(nextSession);
        }
        setSnapshot(nextSnapshot);
        shouldVerifySessionRef.current = false;
        setLoading(false);
      })
      .catch(() => {
        if (!active) {
          return;
        }
        window.localStorage.removeItem(SESSION_STORAGE_KEY);
        setSnapshot(null);
        shouldVerifySessionRef.current = false;
        setSession(null);
      })
      .finally(() => {
        if (active) {
          setLoading(false);
        }
      });

    return () => {
      active = false;
    };
  }, [session, sessionToken]);

  function handleAuthenticated(nextSession: AuthSession) {
    window.localStorage.setItem(SESSION_STORAGE_KEY, JSON.stringify(nextSession));
    setSnapshot(null);
    shouldVerifySessionRef.current = false;
    setLoading(true);
    setSession(nextSession);
  }

  function handleLogout() {
    if (session) {
      void logoutCurrentSession(session).catch(() => undefined);
    }
    window.localStorage.removeItem(SESSION_STORAGE_KEY);
    setSnapshot(null);
    shouldVerifySessionRef.current = false;
    setLoading(false);
    setSession(null);
  }

  if (loading && !session) {
    return (
      <main className="grid-overlay min-h-screen">
        <div className="mx-auto flex min-h-screen w-full max-w-[960px] items-center justify-center px-4">
          <div className="panel-shell border border-[color:var(--border)] px-6 py-5 text-sm text-[color:var(--muted-foreground)]">
            Loading session...
          </div>
        </div>
      </main>
    );
  }

  if (!session) {
    return <AuthPortal onAuthenticated={handleAuthenticated} />;
  }

  if (loading || !snapshot) {
    return (
      <main className="grid-overlay min-h-screen">
        <div className="mx-auto flex min-h-screen w-full max-w-[960px] items-center justify-center px-4">
          <div className="panel-shell border border-[color:var(--border)] px-6 py-5 text-sm text-[color:var(--muted-foreground)]">
            Loading Build AI...
          </div>
        </div>
      </main>
    );
  }

  return (
    <OperationsDashboard
      workspace={workspace}
      snapshot={snapshot}
      health={health}
      session={session}
      onSessionChange={setSession}
      onLogout={handleLogout}
    />
  );
}
