"use client";

import { useState } from "react";
import type { AuthSession, TicketRecord, TicketStatus, Priority } from "@/lib/operations-types";

type Props = {
  tickets: TicketRecord[];
  selectedId: string | null;
  session: AuthSession;
  onSelect: (id: string) => void;
  onCreateNew: () => void;
};

const STATUS_FILTERS = [
  { label: "All", value: "" },
  { label: "Open", value: "open" },
  { label: "Accepted", value: "accepted" },
  { label: "Shipped", value: "outbound_shipped" },
  { label: "Ingestion", value: "transferred_to_ingestion,ingestion_processing" },
  { label: "Closed", value: "closed" },
];

function formatRelative(s: string) {
  try {
    const diff = Date.now() - new Date(s).getTime();
    const m = Math.floor(diff / 60000);
    const h = Math.floor(m / 60);
    const d = Math.floor(h / 24);
    if (d > 1) return `${d}d`;
    if (h > 0) return `${h}h`;
    if (m > 0) return `${m}m`;
    return "now";
  } catch { return ""; }
}

function latestTime(ticket: TicketRecord): string {
  const times = [
    ...(ticket.messages ?? []).map((m) => m.sentAt),
    ...(ticket.timeline ?? []).map((e) => e.occurredAt),
  ].filter(Boolean);
  return times.sort().at(-1) ?? "";
}

function priorityDot(p: Priority) {
  const colors: Record<Priority, string> = {
    high: "var(--error)",
    medium: "#f59e0b",
    low: "var(--border-strong)",
  };
  return (
    <span style={{
      display: "inline-block", width: 6, height: 6, borderRadius: "50%",
      background: colors[p] ?? "var(--border)",
      flexShrink: 0, marginTop: 1,
    }} />
  );
}

function statusLabel(s: TicketStatus) {
  const map: Record<TicketStatus, string> = {
    open: "OPEN", accepted: "ACCPTD", rejected: "REJCTD",
    outbound_shipped: "SHIPPED", factory_received: "RCVD",
    return_shipped: "RTN", hq_received: "HQ RCV",
    transferred_to_ingestion: "INGSTN", ingestion_processing: "PRCSNG",
    ingestion_completed: "DONE", closed: "CLOSED",
  };
  return map[s] ?? s.toUpperCase().slice(0, 6);
}

function matchesStatus(ticket: TicketRecord, filter: string): boolean {
  if (!filter) return true;
  return filter.split(",").includes(ticket.status);
}

export function TicketListPanel({ tickets, selectedId, session, onSelect, onCreateNew }: Props) {
  const [search, setSearch] = useState("");
  const [statusFilter, setStatusFilter] = useState("");
  const role = session.user.role;

  const filtered = tickets
    .filter((t) => {
      const q = search.toLowerCase();
      if (q && !t.title.toLowerCase().includes(q) &&
        !t.teamName.toLowerCase().includes(q) &&
        !t.factoryName.toLowerCase().includes(q) &&
        !t.id.toLowerCase().includes(q)) return false;
      if (!matchesStatus(t, statusFilter)) return false;
      return true;
    })
    .sort((a, b) => {
      const at = latestTime(a);
      const bt = latestTime(b);
      return bt.localeCompare(at);
    });

  const canCreate = role === "factory_operator" || role === "admin";

  return (
    <div className="ticket-list-pane">
      {/* Header */}
      <div style={{ padding: "10px 12px 8px", borderBottom: "1px solid var(--border)", flexShrink: 0, background: "var(--bg)" }}>
        <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 8 }}>
          <span style={{ fontSize: 11, fontWeight: 700, fontFamily: "var(--font-mono)", textTransform: "uppercase", letterSpacing: "0.06em", color: "var(--text-muted)" }}>
            Tickets
          </span>
          {canCreate && (
            <button onClick={onCreateNew} className="btn btn-primary btn-sm" style={{ fontSize: 11, padding: "3px 10px" }}>
              + New
            </button>
          )}
        </div>

        {/* Search */}
        <input
          type="text"
          className="input"
          placeholder="Search tickets..."
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          style={{ fontSize: 12, padding: "5px 8px" }}
        />
      </div>

      {/* Status filter chips */}
      <div style={{
        display: "flex", gap: 4, padding: "6px 10px", overflowX: "auto",
        borderBottom: "1px solid var(--border)", flexShrink: 0, background: "var(--bg)",
      }}>
        {STATUS_FILTERS.map((f) => (
          <button
            key={f.value}
            onClick={() => setStatusFilter(f.value)}
            style={{
              flexShrink: 0,
              padding: "2px 8px",
              fontSize: 10,
              fontFamily: "var(--font-mono)",
              fontWeight: statusFilter === f.value ? 700 : 400,
              border: "1px solid",
              borderColor: statusFilter === f.value ? "var(--text-primary)" : "var(--border)",
              background: statusFilter === f.value ? "var(--text-primary)" : "var(--bg)",
              color: statusFilter === f.value ? "var(--action-text)" : "var(--text-secondary)",
              cursor: "pointer",
              letterSpacing: "0.02em",
              textTransform: "uppercase",
            }}
          >
            {f.label}
          </button>
        ))}
      </div>

      {/* Ticket list */}
      <div style={{ flex: 1, overflowY: "auto" }}>
        {filtered.length === 0 ? (
          <div className="empty-state" style={{ padding: "32px 16px" }}>
            <div className="empty-state-title">No tickets</div>
            <div className="empty-state-desc">
              {search || statusFilter ? "No tickets match your filters." : "No tickets yet."}
            </div>
          </div>
        ) : (
          filtered.map((t) => {
            const time = latestTime(t);
            const lastMsg = t.messages?.[t.messages.length - 1];
            const isSelected = t.id === selectedId;

            return (
              <div
                key={t.id}
                onClick={() => onSelect(t.id)}
                className={`ticket-row${isSelected ? " selected" : ""}`}
              >
                {/* Row 1: priority + ticket ID + status + time */}
                <div style={{ display: "flex", alignItems: "center", gap: 5 }}>
                  {priorityDot(t.priority)}
                  <span className="mono" style={{ fontSize: 10, color: "var(--text-muted)", flex: 1, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
                    #{t.id.slice(0, 8)}
                  </span>
                  <span className={`badge badge-${t.status}`} style={{ fontSize: 9, padding: "0 4px" }}>
                    {statusLabel(t.status)}
                  </span>
                  {time && (
                    <span style={{ fontSize: 10, color: "var(--text-muted)", fontFamily: "var(--font-mono)", flexShrink: 0 }}>
                      {formatRelative(time)}
                    </span>
                  )}
                </div>

                {/* Row 2: team name */}
                <div style={{ fontSize: 12, fontWeight: 600, color: "var(--text-primary)", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
                  {t.teamName}
                </div>

                {/* Row 3: factory + assignee or last message */}
                <div style={{ display: "flex", alignItems: "center", gap: 4, overflow: "hidden" }}>
                  <span style={{ fontSize: 11, color: "var(--text-muted)", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap", flex: 1 }}>
                    {t.factoryName}
                    {lastMsg && !t.assignedToName && (
                      <span style={{ color: "var(--text-placeholder)" }}> · {lastMsg.message.slice(0, 30)}</span>
                    )}
                  </span>
                  {t.assignedToName ? (
                    <span style={{
                      fontSize: 9, padding: "1px 6px", flexShrink: 0,
                      background: "#dbeafe", color: "#1d4ed8",
                      borderRadius: 10, fontWeight: 600, whiteSpace: "nowrap",
                    }}>
                      {t.assignedToName.split(" ")[0]}
                    </span>
                  ) : (["logistics", "admin"].includes(role) && t.status !== "closed" && t.status !== "rejected") ? (
                    <span style={{
                      fontSize: 9, padding: "1px 6px", flexShrink: 0,
                      background: "#fef3c7", color: "#b45309",
                      borderRadius: 10, fontWeight: 600, whiteSpace: "nowrap",
                    }}>
                      Unassigned
                    </span>
                  ) : null}
                </div>
              </div>
            );
          })
        )}
      </div>

      {/* Footer count */}
      <div style={{ padding: "6px 12px", borderTop: "1px solid var(--border)", flexShrink: 0 }}>
        <span style={{ fontSize: 10, color: "var(--text-muted)", fontFamily: "var(--font-mono)" }}>
          {filtered.length} of {tickets.length} tickets
        </span>
      </div>
    </div>
  );
}
