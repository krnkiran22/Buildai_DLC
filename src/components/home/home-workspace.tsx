"use client";

import type { AuthSession, DashboardSnapshot, UserRole } from "@/lib/operations-types";

type Props = {
  snapshot: DashboardSnapshot;
  session: AuthSession;
};

function statusLabel(s: string) {
  const map: Record<string, string> = {
    open: "Open",
    accepted: "Accepted",
    rejected: "Rejected",
    outbound_shipped: "Outbound Shipped",
    factory_received: "Factory Received",
    return_shipped: "Return Shipped",
    hq_received: "HQ Received",
    transferred_to_ingestion: "To Ingestion",
    ingestion_processing: "Processing",
    ingestion_completed: "Completed",
    closed: "Closed",
  };
  return map[s] ?? s;
}

function roleLabel(r: UserRole) {
  const map: Record<UserRole, string> = {
    admin: "Admin",
    logistics: "Logistics",
    factory_operator: "Factory Operator",
    ingestion: "Ingestion",
  };
  return map[r] ?? r;
}

function formatDate(s: string) {
  try { return new Date(s).toLocaleDateString("en-GB", { day: "2-digit", month: "short", year: "numeric" }); } catch { return s; }
}

const STATUS_ORDER = [
  "open", "accepted", "outbound_shipped", "factory_received",
  "return_shipped", "hq_received", "transferred_to_ingestion",
  "ingestion_processing", "ingestion_completed", "closed", "rejected",
];

export function HomeWorkspace({ snapshot, session }: Props) {
  const role = session.user.role;
  const tickets = snapshot.tickets ?? [];

  const statusCounts: Record<string, number> = {};
  for (const t of tickets) {
    statusCounts[t.status] = (statusCounts[t.status] ?? 0) + 1;
  }

  const openCount = tickets.filter((t) => t.status === "open").length;
  const inTransitCount = tickets.filter((t) => t.status === "outbound_shipped").length;
  const pendingIngestion = (snapshot.ingestionQueue ?? []).filter((q) => q.status === "transferred_to_ingestion" || q.status === "ingestion_processing").length;
  const totalMissing = (snapshot.inventoryItems ?? []).reduce((s, i) => s + i.missingUnits, 0);

  const recentTickets = [...tickets]
    .sort((a, b) => {
      const at = a.timeline?.[a.timeline.length - 1]?.occurredAt ?? "";
      const bt = b.timeline?.[b.timeline.length - 1]?.occurredAt ?? "";
      return bt.localeCompare(at);
    })
    .slice(0, 8);

  return (
    <div style={{ height: "100%", overflowY: "auto", background: "var(--bg-subtle)" }}>
      {/* Header */}
      <div className="workspace-header" style={{ background: "var(--bg)" }}>
        <div style={{ fontSize: 13, fontWeight: 700, color: "var(--text-primary)" }}>Overview</div>
        <div style={{ fontSize: 11, color: "var(--text-muted)", marginLeft: "auto", fontFamily: "var(--font-mono)" }}>
          {roleLabel(role)} · {session.user.displayName}
        </div>
      </div>

      <div style={{ padding: "20px", display: "flex", flexDirection: "column", gap: 20 }}>

        {/* Role-aware Quick Actions */}
        <RoleQuickActions role={role} tickets={tickets} />

        {/* Metric strip */}
        <div className="metric-grid">
          <MetricCell label="Open Tickets" value={openCount} />
          <MetricCell label="In Transit" value={inTransitCount} />
          <MetricCell label="Ingestion Queue" value={pendingIngestion} />
          <MetricCell label="Missing Units" value={totalMissing} alert={totalMissing > 0} />
          {(role === "admin" || role === "logistics") && (
            <MetricCell label="Total Tickets" value={tickets.length} />
          )}
        </div>

        {/* Status breakdown */}
        {tickets.length > 0 && (
          <div className="panel">
            <div className="panel-header">
              <span className="panel-title">Ticket Status Breakdown</span>
              <span className="mono" style={{ color: "var(--text-muted)" }}>{tickets.length} total</span>
            </div>
            <div style={{ padding: "4px 0" }}>
              {STATUS_ORDER.filter((s) => (statusCounts[s] ?? 0) > 0).map((s) => (
                <div key={s} style={{
                  display: "flex", alignItems: "center", padding: "7px 14px",
                  borderBottom: "1px solid var(--border)", gap: 10,
                }}>
                  <span className={`badge badge-${s}`}>{statusLabel(s)}</span>
                  <div style={{ flex: 1, height: 4, background: "var(--bg-muted)", position: "relative", overflow: "hidden" }}>
                    <div style={{
                      position: "absolute", left: 0, top: 0, bottom: 0,
                      width: `${(statusCounts[s] / tickets.length) * 100}%`,
                      background: "var(--text-primary)",
                    }} />
                  </div>
                  <span className="mono" style={{ fontSize: 12, color: "var(--text-secondary)", minWidth: 24, textAlign: "right" }}>
                    {statusCounts[s]}
                  </span>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* Recent tickets */}
        {recentTickets.length > 0 && (
          <div className="panel">
            <div className="panel-header">
              <span className="panel-title">Recent Activity</span>
              <a href="/tickets" style={{ fontSize: 11, color: "var(--text-muted)", textDecoration: "underline" }}>View all</a>
            </div>
            <div className="data-table-wrap">
            <table className="data-table">
              <thead>
                <tr>
                  <th>Ticket</th>
                  <th>Status</th>
                  <th>Team</th>
                  <th>Factory</th>
                  <th>Deploy Date</th>
                </tr>
              </thead>
              <tbody>
                {recentTickets.map((t) => (
                  <tr key={t.id}>
                    <td>
                      <a href="/tickets" style={{ textDecoration: "none" }}>
                        <div style={{ fontFamily: "var(--font-mono)", fontSize: 11, color: "var(--text-muted)" }}>
                          #{t.id.slice(0, 8)}
                        </div>
                        <div style={{ fontSize: 12, color: "var(--text-primary)", fontWeight: 500, marginTop: 1, maxWidth: 200, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
                          {t.title}
                        </div>
                      </a>
                    </td>
                    <td><span className={`badge badge-${t.status}`}>{statusLabel(t.status)}</span></td>
                    <td style={{ fontSize: 12, color: "var(--text-secondary)" }}>{t.teamName}</td>
                    <td style={{ fontSize: 12, color: "var(--text-secondary)" }}>{t.factoryName}</td>
                    <td className="mono" style={{ fontSize: 11, color: "var(--text-muted)" }}>{formatDate(t.deploymentDate)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
            </div>
          </div>
        )}

        {/* Ingestion queue preview */}
        {(role === "admin" || role === "logistics" || role === "ingestion") && (snapshot.ingestionQueue?.length ?? 0) > 0 && (
          <div className="panel">
            <div className="panel-header">
              <span className="panel-title">Ingestion Queue</span>
              <a href="/ingestion" style={{ fontSize: 11, color: "var(--text-muted)", textDecoration: "underline" }}>Manage</a>
            </div>
            <div className="data-table-wrap">
            <table className="data-table">
              <thead>
                <tr>
                  <th>Packet</th>
                  <th>Team</th>
                  <th>Factory</th>
                  <th>SD Cards</th>
                  <th>Status</th>
                </tr>
              </thead>
              <tbody>
                {(snapshot.ingestionQueue ?? []).slice(0, 5).map((q) => (
                  <tr key={q.id}>
                    <td className="mono" style={{ fontSize: 11 }}>{q.packageCode}</td>
                    <td style={{ fontSize: 12 }}>{q.teamName}</td>
                    <td style={{ fontSize: 12 }}>{q.factoryName}</td>
                    <td className="mono" style={{ fontSize: 12 }}>{q.expectedSdCards}</td>
                    <td><span className={`badge badge-${q.status}`}>{statusLabel(q.status)}</span></td>
                  </tr>
                ))}
              </tbody>
            </table>
            </div>
          </div>
        )}

        {/* Merit scores preview */}
        {(role === "admin" || role === "logistics") && (snapshot.meritScores?.length ?? 0) > 0 && (
          <div className="panel">
            <div className="panel-header">
              <span className="panel-title">Team Merit Scores</span>
              <a href="/merit" style={{ fontSize: 11, color: "var(--text-muted)", textDecoration: "underline" }}>Details</a>
            </div>
            <div className="data-table-wrap">
            <table className="data-table">
              <thead>
                <tr>
                  <th>Team</th>
                  <th>Score</th>
                  <th>SD Card Shortfall</th>
                  <th>Device Shortfall</th>
                </tr>
              </thead>
              <tbody>
                {[...(snapshot.meritScores ?? [])].sort((a, b) => a.score - b.score).slice(0, 5).map((m) => (
                  <tr key={m.teamName}>
                    <td style={{ fontSize: 13, fontWeight: 500 }}>{m.teamName}</td>
                    <td>
                      <span className={`mono ${m.score >= 90 ? "merit-score-high" : m.score >= 70 ? "merit-score-medium" : "merit-score-low"}`}
                        style={{ fontSize: 16, fontWeight: 700 }}>
                        {m.score}
                      </span>
                      {m.score < 70 && <span className="badge badge-rejected" style={{ marginLeft: 6 }}>Risk</span>}
                    </td>
                    <td className="mono" style={{ fontSize: 12, color: m.sdCardShortfall > 0 ? "var(--error)" : "var(--text-muted)" }}>
                      {m.sdCardShortfall > 0 ? `-${m.sdCardShortfall}` : "—"}
                    </td>
                    <td className="mono" style={{ fontSize: 12, color: m.deviceShortfall > 0 ? "var(--error)" : "var(--text-muted)" }}>
                      {m.deviceShortfall > 0 ? `-${m.deviceShortfall}` : "—"}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
            </div>
          </div>
        )}

        {tickets.length === 0 && (
          <div className="empty-state">
            <div className="empty-state-icon">◫</div>
            <div className="empty-state-title">No tickets yet</div>
            <div className="empty-state-desc">
              {role === "factory_operator"
                ? "Create a deployment ticket to get started."
                : "Tickets from factory teams will appear here."}
            </div>
            {role === "factory_operator" && (
              <a href="/tickets" className="btn btn-primary" style={{ marginTop: 8 }}>Open Tickets</a>
            )}
          </div>
        )}
      </div>
    </div>
  );
}

/* ─── Role Quick Actions ────────────────────────────────────── */
function RoleQuickActions({ role, tickets }: { role: UserRole; tickets: { status: string; assignedToName?: string | null }[] }) {
  const unassigned = tickets.filter((t) => t.status === "open" && !t.assignedToName).length;
  const inIngestion = tickets.filter((t) => t.status === "transferred_to_ingestion" || t.status === "ingestion_processing").length;

  const actions: { label: string; desc: string; href: string; icon: string; highlight?: boolean }[] = [];

  if (role === "factory_operator") {
    actions.push({ label: "Request Devices", desc: "Open a new ticket to request SD cards and devices", href: "/tickets", icon: "📦", highlight: true });
    actions.push({ label: "My Tickets", desc: "View status of your requests", href: "/tickets", icon: "📋" });
  } else if (role === "logistics") {
    if (unassigned > 0) actions.push({ label: `${unassigned} Unassigned`, desc: "Open tickets waiting for someone to claim", href: "/tickets", icon: "🔔", highlight: true });
    actions.push({ label: "All Tickets", desc: "View and manage all deployment requests", href: "/tickets", icon: "🚚" });
    actions.push({ label: "Inventory", desc: "Check stock levels before accepting requests", href: "/inventory", icon: "📊" });
  } else if (role === "ingestion") {
    if (inIngestion > 0) actions.push({ label: `${inIngestion} Pending`, desc: "SD cards waiting to be processed", href: "/ingestion", icon: "⚡", highlight: true });
    actions.push({ label: "Ingestion Queue", desc: "Process returned SD cards", href: "/ingestion", icon: "🗂" });
    actions.push({ label: "Movement Log", desc: "View full device movement history", href: "/movement", icon: "↔️" });
  } else if (role === "admin") {
    if (unassigned > 0) actions.push({ label: `${unassigned} Unassigned`, desc: "Open tickets waiting for logistics to claim", href: "/tickets", icon: "🔔", highlight: true });
    actions.push({ label: "All Tickets", desc: "Manage all deployment requests", href: "/tickets", icon: "📋" });
    actions.push({ label: "Inventory", desc: "Manage stock levels", href: "/inventory", icon: "📊" });
    actions.push({ label: "Merit Scores", desc: "Team performance overview", href: "/merit", icon: "⭐" });
  }

  if (actions.length === 0) return null;

  return (
    <div className="stagger" style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(160px, 1fr))", gap: 12 }}>
      {actions.map((a) => (
        <a key={a.label} href={a.href} className="anim-scale" style={{
          display: "flex", flexDirection: "column", gap: 6, padding: "14px 16px",
          background: a.highlight ? "var(--action)" : "var(--bg)",
          border: `1px solid ${a.highlight ? "var(--action)" : "var(--border)"}`,
          borderRadius: 6, textDecoration: "none",
          boxShadow: a.highlight ? "0 2px 8px rgba(0,0,0,0.12)" : "none",
          transition: "opacity 0.15s",
        }}>
          <span style={{ fontSize: 22 }}>{a.icon}</span>
          <span style={{ fontSize: 13, fontWeight: 700, color: a.highlight ? "#fff" : "var(--text-primary)" }}>{a.label}</span>
          <span style={{ fontSize: 11, color: a.highlight ? "rgba(255,255,255,0.75)" : "var(--text-muted)", lineHeight: 1.4 }}>{a.desc}</span>
        </a>
      ))}
    </div>
  );
}

function MetricCell({ label, value, alert }: { label: string; value: number; alert?: boolean }) {
  return (
    <div className="metric-cell">
      <div className="metric-value" style={{ color: alert && value > 0 ? "var(--error)" : "var(--text-primary)" }}>
        {value}
      </div>
      <div className="metric-label">{label}</div>
    </div>
  );
}
