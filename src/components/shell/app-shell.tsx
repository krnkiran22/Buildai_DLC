"use client";

import Link from "next/link";
import { useCallback, useEffect, useRef, useState } from "react";
import { AuthScreen } from "@/components/auth/auth-screen";
import { HomeWorkspace } from "@/components/home/home-workspace";
import { IngestionWorkspace } from "@/components/ingestion/ingestion-workspace";
import { InventoryWorkspace } from "@/components/inventory/inventory-workspace";
import { MeritWorkspace } from "@/components/merit/merit-workspace";
import { MovementWorkspace } from "@/components/movement/movement-workspace";
import { TicketWorkspace } from "@/components/tickets/ticket-workspace";
import {
  getBackendHealth,
  getCurrentSession,
  getOperationsSnapshot,
  isSessionExpiredError,
  logoutCurrentSession,
} from "@/lib/backend";
import type {
  AuthSession,
  BackendHealth,
  DashboardSnapshot,
  UserRole,
} from "@/lib/operations-types";

const SESSION_KEY = "moto_ops_session";

export type WorkspaceId =
  | "home"
  | "tickets"
  | "ingestion"
  | "movement"
  | "merit"
  | "inventory";

function sessionsEqual(a: AuthSession | null, b: AuthSession | null) {
  if (a === b) return true;
  if (!a || !b) return false;
  return (
    a.token === b.token &&
    a.user.id === b.user.id &&
    a.user.role === b.user.role &&
    a.permissions.join("|") === b.permissions.join("|")
  );
}

function roleLabel(role: UserRole): string {
  const map: Record<UserRole, string> = {
    admin: "Admin",
    logistics: "Logistics",
    factory_operator: "Factory Operator",
    ingestion: "Ingestion",
  };
  return map[role] ?? role;
}

type NavItem = {
  id: WorkspaceId;
  label: string;
  href: string;
  roles: UserRole[];
  icon: string;
};

const NAV_ITEMS: NavItem[] = [
  { id: "home", label: "Overview", href: "/", roles: ["admin", "logistics", "factory_operator", "ingestion"], icon: "▦" },
  { id: "tickets", label: "Tickets", href: "/tickets", roles: ["admin", "logistics", "factory_operator", "ingestion"], icon: "◫" },
  { id: "ingestion", label: "Ingestion", href: "/ingestion", roles: ["admin", "logistics", "ingestion"], icon: "⊞" },
  { id: "movement", label: "Movement", href: "/movement", roles: ["admin", "logistics"], icon: "⇌" },
  { id: "merit", label: "Merit Scores", href: "/merit", roles: ["admin", "logistics", "ingestion"], icon: "◈" },
  { id: "inventory", label: "Inventory", href: "/inventory", roles: ["admin", "logistics"], icon: "⊟" },
];

type Props = {
  workspace: WorkspaceId;
};

const SESSION_RECHECK_MS = 8 * 60 * 1000; // re-verify token every 8 minutes

export function AppShell({ workspace }: Props) {
  const [session, setSession] = useState<AuthSession | null>(null);
  const [snapshot, setSnapshot] = useState<DashboardSnapshot | null>(null);
  const [health, setHealth] = useState<BackendHealth>({
    ok: false,
    service: "Build AI",
    environment: "loading",
    baseUrl: "",
  });
  const [loading, setLoading] = useState(true);
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const [sessionExpiredBanner, setSessionExpiredBanner] = useState(false);
  const verifyRef = useRef(false);
  const recheckTimerRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const token = session?.token ?? null;

  /* ── force-logout helper ── */
  const handleLogout = useCallback((expired = false) => {
    if (session) void logoutCurrentSession(session).catch(() => {});
    window.localStorage.removeItem(SESSION_KEY);
    if (recheckTimerRef.current) clearInterval(recheckTimerRef.current);
    recheckTimerRef.current = null;
    setSession(null);
    setSnapshot(null);
    verifyRef.current = false;
    setLoading(false);
    if (expired) setSessionExpiredBanner(true);
  }, [session]);

  /* ── periodic token re-check ── */
  useEffect(() => {
    if (!session?.token) return;
    if (recheckTimerRef.current) clearInterval(recheckTimerRef.current);

    recheckTimerRef.current = setInterval(async () => {
      try {
        await getCurrentSession(session);
      } catch (err) {
        if (isSessionExpiredError(err)) {
          handleLogout(true);
        }
      }
    }, SESSION_RECHECK_MS);

    return () => {
      if (recheckTimerRef.current) clearInterval(recheckTimerRef.current);
    };
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [session?.token]);

  /* ── Restore session from localStorage ── */
  useEffect(() => {
    const raw = window.localStorage.getItem(SESSION_KEY);
    if (raw) {
      try {
        setSession(JSON.parse(raw) as AuthSession);
        verifyRef.current = true;
        return;
      } catch {
        window.localStorage.removeItem(SESSION_KEY);
      }
    }
    setLoading(false);
  }, []);

  /* ── Health check ── */
  useEffect(() => {
    let active = true;
    getBackendHealth()
      .then((h) => { if (active) setHealth(h); })
      .catch(() => {});
    return () => { active = false; };
  }, []);

  /* ── Load snapshot (and verify token on first restore) ── */
  useEffect(() => {
    if (!token || !session) return;
    let active = true;

    void (async () => {
      try {
        // Always verify token when restoring from localStorage
        const nextSession = verifyRef.current
          ? await getCurrentSession(session)   // throws SessionExpiredError on 401
          : session;

        const nextSnapshot = await getOperationsSnapshot(nextSession);
        if (!active) return;
        window.localStorage.setItem(SESSION_KEY, JSON.stringify(nextSession));
        if (!sessionsEqual(session, nextSession)) setSession(nextSession);
        setSnapshot(nextSnapshot);
        verifyRef.current = false;
      } catch (err) {
        if (!active) return;
        window.localStorage.removeItem(SESSION_KEY);
        setSession(null);
        setSnapshot(null);
        verifyRef.current = false;
        if (isSessionExpiredError(err)) setSessionExpiredBanner(true);
      } finally {
        if (active) setLoading(false);
      }
    })();

    return () => { active = false; };
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [session?.token]);

  function handleAuthenticated(s: AuthSession) {
    window.localStorage.setItem(SESSION_KEY, JSON.stringify(s));
    verifyRef.current = false;
    setSessionExpiredBanner(false);
    setLoading(true);
    setSnapshot(null);
    setSession(s);
  }

  function handleSessionChange(s: AuthSession | null) {
    if (s) {
      window.localStorage.setItem(SESSION_KEY, JSON.stringify(s));
      setSession(s);
    } else {
      handleLogout();
    }
  }

  // Loading before session resolved
  if (loading && !session) {
    return (
      <div style={{
        minHeight: "100vh", display: "flex", alignItems: "center",
        justifyContent: "center", background: "var(--bg)",
      }}>
        <div style={{ display: "flex", alignItems: "center", gap: 10, color: "var(--text-muted)", fontSize: 13 }}>
          <span className="spinner" />
          Loading Build AI...
        </div>
      </div>
    );
  }

  // Not authenticated (or session expired)
  if (!session) {
    return (
      <>
        {/* Session expired: full overlay that auto-dismisses after 3 s */}
        {sessionExpiredBanner && (
          <SessionExpiredOverlay onDismiss={() => setSessionExpiredBanner(false)} />
        )}
        <AuthScreen onAuthenticated={handleAuthenticated} />
      </>
    );
  }

  // Loading snapshot
  if (loading || !snapshot) {
    return (
      <div style={{ display: "flex", height: "100vh", overflow: "hidden", background: "var(--bg)" }}>
        <SidebarSkeleton />
        <div style={{
          flex: 1, display: "flex", alignItems: "center",
          justifyContent: "center", background: "var(--bg-subtle)",
        }}>
          <div style={{ display: "flex", alignItems: "center", gap: 10, color: "var(--text-muted)", fontSize: 13 }}>
            <span className="spinner" />
            Loading workspace...
          </div>
        </div>
      </div>
    );
  }

  const role = session.user.role;
  const visibleNav = NAV_ITEMS.filter((n) => n.roles.includes(role));

  return (
    <div style={{ display: "flex", height: "100vh", overflow: "hidden", background: "var(--bg)" }}>
      {/* Mobile overlay */}
      {sidebarOpen && (
        <div
          onClick={() => setSidebarOpen(false)}
          style={{
            position: "fixed", inset: 0, background: "rgba(0,0,0,0.4)",
            zIndex: 40, display: "none",
          }}
          className="mobile-overlay"
        />
      )}

      {/* Sidebar */}
      <aside
        style={{
          width: 176,
          minWidth: 176,
          height: "100vh",
          borderRight: "1px solid var(--border)",
          background: "var(--bg)",
          display: "flex",
          flexDirection: "column",
          overflow: "hidden",
          flexShrink: 0,
          zIndex: 50,
        }}
        className={`app-sidebar${sidebarOpen ? " sidebar-open" : ""}`}
      >
        {/* Brand */}
        <div style={{
          padding: "16px 14px 12px",
          borderBottom: "1px solid var(--border)",
          flexShrink: 0,
          display: "flex",
          alignItems: "center",
          justifyContent: "space-between",
        }}>
          <div>
            <div style={{ fontSize: 16, fontWeight: 800, letterSpacing: "-0.03em", color: "var(--text-primary)" }}>
              Build AI
            </div>
            <div style={{
              fontSize: 9, color: "var(--text-muted)", fontFamily: "var(--font-mono)",
              marginTop: 1, textTransform: "uppercase", letterSpacing: "0.08em",
            }}>
              Operations
            </div>
          </div>
          <button
            onClick={() => setSidebarOpen(false)}
            className="sidebar-close-btn"
            style={{
              display: "none", background: "none", border: "none",
              fontSize: 20, cursor: "pointer", color: "var(--text-muted)", lineHeight: 1,
            }}
            aria-label="Close sidebar"
          >
            ×
          </button>
        </div>

        {/* Navigation */}
        <nav style={{ flex: 1, overflowY: "auto", padding: "6px 0" }}>
          {visibleNav.map((item) => (
            <Link
              key={item.id}
              href={item.href}
              onClick={() => setSidebarOpen(false)}
              style={{
                display: "flex",
                alignItems: "center",
                gap: 8,
                padding: "8px 14px",
                fontSize: 13,
                color: workspace === item.id ? "var(--text-primary)" : "var(--text-secondary)",
                cursor: "pointer",
                borderLeft: `2px solid ${workspace === item.id ? "var(--action)" : "transparent"}`,
                background: workspace === item.id ? "var(--bg-subtle)" : "transparent",
                fontWeight: workspace === item.id ? 600 : 400,
                textDecoration: "none",
                transition: "all 0.1s",
              }}
            >
              <span style={{ fontSize: 11, width: 18, textAlign: "center", flexShrink: 0 }}>
                {item.icon}
              </span>
              <span>{item.label}</span>
            </Link>
          ))}

          {/* Scanner Station — external link, opens in new tab */}
          <a
            href="/scan"
            target="_blank"
            rel="noreferrer"
            onClick={() => setSidebarOpen(false)}
            style={{
              display: "flex", alignItems: "center", gap: 8,
              padding: "8px 14px", fontSize: 13,
              color: "var(--text-secondary)", cursor: "pointer",
              borderLeft: "2px solid transparent",
              textDecoration: "none", marginTop: 4,
              borderTop: "1px dashed var(--border)",
              paddingTop: 10,
            }}
          >
            <span style={{ fontSize: 11, width: 18, textAlign: "center", flexShrink: 0 }}>⬡</span>
            <span>Scanner Station</span>
            <span style={{ fontSize: 9, marginLeft: "auto", color: "var(--text-muted)" }}>↗</span>
          </a>
        </nav>

        {/* User info */}
        <div style={{ borderTop: "1px solid var(--border)", padding: "10px 12px", flexShrink: 0 }}>
          <div style={{
            fontSize: 11, fontWeight: 600, color: "var(--text-primary)",
            marginBottom: 1, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap",
          }}>
            {session.user.displayName}
          </div>
          <div style={{
            fontSize: 9, color: "var(--text-muted)", fontFamily: "var(--font-mono)",
            textTransform: "uppercase", marginBottom: 8,
            overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap",
          }}>
            {roleLabel(role)}
          </div>
          <div style={{ display: "flex", alignItems: "center", gap: 5 }}>
            <div style={{
              width: 6, height: 6, borderRadius: "50%", flexShrink: 0,
              background: health.ok ? "#1a7f37" : "#888",
            }} />
            <span style={{ fontSize: 9, color: "var(--text-muted)", flex: 1, overflow: "hidden", textOverflow: "ellipsis" }}>
              {health.ok ? health.environment : "offline"}
            </span>
            <button
              onClick={() => handleLogout()}
              style={{
                fontSize: 10, padding: "2px 7px", cursor: "pointer",
                border: "1px solid var(--border)", background: "var(--bg)",
                color: "var(--text-secondary)",
              }}
            >
              Out
            </button>
          </div>
        </div>
      </aside>

      {/* Main content */}
      <div style={{
        flex: 1, minWidth: 0, height: "100vh",
        overflow: "hidden", display: "flex", flexDirection: "column",
        background: "var(--bg-subtle)",
      }}>
        {/* Mobile top bar */}
        <div
          className="mobile-topbar"
          style={{
            display: "none", alignItems: "center", gap: 10,
            padding: "0 14px", height: 44, borderBottom: "1px solid var(--border)",
            background: "var(--bg)", flexShrink: 0,
          }}
        >
          <button
            onClick={() => setSidebarOpen(true)}
            style={{
              background: "none", border: "none", fontSize: 18,
              cursor: "pointer", color: "var(--text-primary)", padding: "0 4px",
            }}
            aria-label="Open menu"
          >
            ☰
          </button>
          <span style={{ fontSize: 14, fontWeight: 800, letterSpacing: "-0.02em" }}>Build AI</span>
          <span style={{
            fontSize: 10, color: "var(--text-muted)", fontFamily: "var(--font-mono)",
            textTransform: "uppercase", letterSpacing: "0.06em",
          }}>
            {workspace}
          </span>
        </div>

        {/* Workspace */}
        <div style={{ flex: 1, overflow: "hidden" }}>
          {workspace === "home" && <HomeWorkspace snapshot={snapshot} session={session} />}
          {workspace === "tickets" && (
            <TicketWorkspace
              snapshot={snapshot}
              session={session}
              onSessionChange={handleSessionChange}
            />
          )}
          {workspace === "ingestion" && <IngestionWorkspace snapshot={snapshot} session={session} />}
          {workspace === "movement" && <MovementWorkspace snapshot={snapshot} session={session} />}
          {workspace === "merit" && <MeritWorkspace snapshot={snapshot} session={session} />}
          {workspace === "inventory" && <InventoryWorkspace snapshot={snapshot} session={session} />}
        </div>
      </div>
    </div>
  );
}

/* ── Session Expired Overlay ────────────────────────────────── */
function SessionExpiredOverlay({ onDismiss }: { onDismiss: () => void }) {
  // Auto-dismiss after 3 s — login form is already visible behind it
  useEffect(() => {
    const t = setTimeout(onDismiss, 3000);
    return () => clearTimeout(t);
  }, [onDismiss]);

  return (
    <div style={{
      position: "fixed", inset: 0, zIndex: 9999,
      background: "rgba(0,0,0,0.65)", backdropFilter: "blur(2px)",
      display: "flex", alignItems: "center", justifyContent: "center",
    }}
      onClick={onDismiss}
    >
      <div style={{
        background: "#1a0000", border: "1px solid #dc2626", borderRadius: 10,
        padding: "28px 36px", maxWidth: 340, textAlign: "center",
        boxShadow: "0 20px 60px rgba(0,0,0,0.5)",
      }}
        onClick={(e) => e.stopPropagation()}
      >
        <div style={{ fontSize: 40, marginBottom: 12 }}>🔒</div>
        <div style={{ fontSize: 18, fontWeight: 800, color: "#fca5a5", marginBottom: 8 }}>
          Session Expired
        </div>
        <div style={{ fontSize: 13, color: "#fca5a5", opacity: 0.8, marginBottom: 20, lineHeight: 1.5 }}>
          Your session has timed out. Please log in again to continue.
        </div>
        <button
          onClick={onDismiss}
          style={{
            padding: "10px 28px", background: "#dc2626", border: "none",
            color: "#fff", fontWeight: 700, fontSize: 14, cursor: "pointer", borderRadius: 6,
          }}
        >
          Log In Again
        </button>
        <div style={{ marginTop: 10, fontSize: 11, color: "#fca5a5", opacity: 0.5 }}>
          Redirecting automatically…
        </div>
      </div>
    </div>
  );
}

function SidebarSkeleton() {
  return (
    <div style={{
      width: 176, minWidth: 176, height: "100vh",
      borderRight: "1px solid var(--border)", background: "var(--bg)",
      display: "flex", flexDirection: "column", flexShrink: 0,
    }}>
      <div style={{ padding: "16px 14px", borderBottom: "1px solid var(--border)" }}>
        <div style={{ fontSize: 16, fontWeight: 800, color: "var(--text-primary)" }}>Build AI</div>
        <div style={{ fontSize: 9, color: "var(--text-muted)", fontFamily: "var(--font-mono)", marginTop: 1, textTransform: "uppercase" }}>Operations</div>
      </div>
      <div style={{ padding: "8px 0" }}>
        {[1, 2, 3].map((i) => (
          <div key={i} style={{
            height: 36, margin: "2px 10px",
            background: "var(--bg-muted)",
            animation: "pulse 1.5s ease-in-out infinite",
            animationDelay: `${i * 0.1}s`,
          }} />
        ))}
      </div>
    </div>
  );
}
