"use client";

import { useEffect, useState } from "react";
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

export function OperationsApp() {
  const [session, setSession] = useState<AuthSession | null>(null);
  const [snapshot, setSnapshot] = useState<DashboardSnapshot | null>(null);
  const [health, setHealth] = useState<BackendHealth | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    Promise.resolve().then(() => {
      const rawSession = window.localStorage.getItem(SESSION_STORAGE_KEY);
      if (rawSession) {
        try {
          setSession(JSON.parse(rawSession) as AuthSession);
          return;
        } catch {
          window.localStorage.removeItem(SESSION_STORAGE_KEY);
        }
      }
      setLoading(false);
    });
  }, []);

  useEffect(() => {
    if (!session) {
      return;
    }

    let active = true;

    Promise.resolve()
      .then(async () => {
        const verifiedSession = await getCurrentSession(session).catch(() => session);
        const [nextSnapshot, nextHealth] = await Promise.all([
          getOperationsSnapshot(verifiedSession),
          getBackendHealth(),
        ]);
        if (!active) {
          return;
        }
        window.localStorage.setItem(SESSION_STORAGE_KEY, JSON.stringify(verifiedSession));
        setSession(verifiedSession);
        setSnapshot(nextSnapshot);
        setHealth(nextHealth);
      })
      .catch(() => {
        if (!active) {
          return;
        }
        window.localStorage.removeItem(SESSION_STORAGE_KEY);
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
  }, [session]);

  function handleAuthenticated(nextSession: AuthSession) {
    window.localStorage.setItem(SESSION_STORAGE_KEY, JSON.stringify(nextSession));
    setLoading(true);
    setSession(nextSession);
  }

  function handleLogout() {
    if (session) {
      void logoutCurrentSession(session).catch(() => undefined);
    }
    window.localStorage.removeItem(SESSION_STORAGE_KEY);
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

  if (loading || !snapshot || !health) {
    return (
      <main className="grid-overlay min-h-screen">
        <div className="mx-auto flex min-h-screen w-full max-w-[960px] items-center justify-center px-4">
          <div className="panel-shell border border-[color:var(--border)] px-6 py-5 text-sm text-[color:var(--muted-foreground)]">
            Loading Moto Ops Control...
          </div>
        </div>
      </main>
    );
  }

  return (
    <OperationsDashboard
      snapshot={snapshot}
      health={health}
      session={session}
      onSessionChange={setSession}
      onLogout={handleLogout}
    />
  );
}
