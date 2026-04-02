"use client";

import type { AuthSession, DashboardSnapshot, MovementRecord } from "@/lib/operations-types";

type Props = {
  snapshot: DashboardSnapshot;
  session: AuthSession;
};

function formatDate(s: string) {
  try {
    return new Date(s).toLocaleDateString("en-GB", { day: "2-digit", month: "short", year: "numeric", hour: "2-digit", minute: "2-digit" });
  } catch { return s; }
}

function directionArrow(record: MovementRecord) {
  const path = record.routePath ?? [];
  if (path.length >= 2) {
    return path.join(" → ");
  }
  return `${record.sourceLabel} → ${record.destinationLabel}`;
}

export function MovementWorkspace({ snapshot, session }: Props) {
  const history = snapshot.movementHistory ?? [];
  void session;

  const totalDevices = history.reduce((s, r) => s + r.devicesCount, 0);
  const totalSdCards = history.reduce((s, r) => s + r.sdCardsCount, 0);

  return (
    <div style={{ height: "100%", display: "flex", flexDirection: "column", overflow: "hidden" }}>
      {/* Header */}
      <div className="workspace-header">
        <div style={{ fontSize: 13, fontWeight: 700 }}>Movement Ledger</div>
        <div style={{ marginLeft: "auto", display: "flex", gap: 16, fontSize: 11, color: "var(--text-muted)" }}>
          <span>{history.length} movements</span>
          <span className="mono">Devices: {totalDevices}</span>
          <span className="mono">SD Cards: {totalSdCards}</span>
        </div>
      </div>

      <div style={{ flex: 1, overflowY: "auto", padding: "0" }}>
        {history.length === 0 ? (
          <div className="empty-state" style={{ height: "100%" }}>
            <div className="empty-state-icon">⇌</div>
            <div className="empty-state-title">No movement history</div>
            <div className="empty-state-desc">
              Device and inventory movements between HQ and factories will appear here as a full audit ledger.
            </div>
          </div>
        ) : (
          <table className="data-table">
            <thead style={{ position: "sticky", top: 0, background: "var(--bg)", zIndex: 1 }}>
              <tr>
                <th>Ticket</th>
                <th>Type</th>
                <th>Route</th>
                <th>Devices</th>
                <th>SD Cards</th>
                <th>Hubs</th>
                <th>Cables</th>
                <th>Packages</th>
                <th>Status</th>
                <th>Last Event</th>
              </tr>
            </thead>
            <tbody>
              {history.map((r) => (
                <tr key={r.id}>
                  <td>
                    <div className="mono" style={{ fontSize: 11, color: "var(--text-muted)" }}>#{r.ticketId.slice(0, 8)}</div>
                    {r.routeSummary && (
                      <div style={{ fontSize: 11, color: "var(--text-secondary)", maxWidth: 160, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
                        {r.routeSummary}
                      </div>
                    )}
                  </td>
                  <td>
                    <span className="badge">{r.ticketType}</span>
                  </td>
                  <td style={{ fontSize: 11, color: "var(--text-secondary)", maxWidth: 200 }}>
                    <div style={{ overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
                      {directionArrow(r)}
                    </div>
                    {r.relatedTicketId && (
                      <div className="mono" style={{ fontSize: 10, color: "var(--text-muted)", marginTop: 1 }}>
                        Related: #{r.relatedTicketId.slice(0, 8)}
                      </div>
                    )}
                  </td>
                  <td className="mono">{r.devicesCount > 0 ? r.devicesCount : "—"}</td>
                  <td className="mono">{r.sdCardsCount > 0 ? r.sdCardsCount : "—"}</td>
                  <td className="mono" style={{ color: "var(--text-muted)" }}>{r.usbHubsCount > 0 ? r.usbHubsCount : "—"}</td>
                  <td className="mono" style={{ color: "var(--text-muted)" }}>{r.cablesCount > 0 ? r.cablesCount : "—"}</td>
                  <td className="mono">{r.packageCount}</td>
                  <td><span className={`badge badge-${r.status}`}>{r.status.replace(/_/g, " ")}</span></td>
                  <td className="mono" style={{ fontSize: 10, color: "var(--text-muted)" }}>
                    {formatDate(r.lastEventAt)}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>

      {/* Notes footer */}
      {history.length > 0 && (
        <div style={{ padding: "8px 14px", borderTop: "1px solid var(--border)", background: "var(--bg-subtle)", fontSize: 10, color: "var(--text-muted)", fontFamily: "var(--font-mono)" }}>
          Full chain-of-custody audit trail · {history.length} records · All times in local timezone
        </div>
      )}
    </div>
  );
}
