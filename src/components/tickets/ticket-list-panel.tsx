"use client";

import { useMemo, useState } from "react";
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
  { label: "In Transit", value: "factory_received,return_shipped,hq_received" },
  { label: "Ingestion", value: "transferred_to_ingestion,ingestion_processing,ingestion_completed" },
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
    outbound_shipped: "SHIPPED", factory_received: "AT FCTY",
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

/** All unique people who appear in the ticket list */
function derivePeople(tickets: TicketRecord[]): string[] {
  const set = new Set<string>();
  for (const t of tickets) {
    if (t.requestOwner) set.add(t.requestOwner);
    if (t.assignedToName) set.add(t.assignedToName);
    for (const m of t.members ?? []) {
      if (m.displayName) set.add(m.displayName);
    }
  }
  return Array.from(set).sort();
}

function matchesPerson(ticket: TicketRecord, person: string, myName: string): boolean {
  if (!person) return true;
  if (person === "__mine__") {
    return (
      ticket.requestOwner === myName ||
      ticket.assignedToName === myName ||
      (ticket.members ?? []).some((m) => m.displayName === myName)
    );
  }
  return (
    ticket.requestOwner === person ||
    ticket.assignedToName === person ||
    (ticket.members ?? []).some((m) => m.displayName === person)
  );
}

// Initial + color for person avatar
function personInitial(name: string) {
  return name?.[0]?.toUpperCase() ?? "?";
}

const AVATAR_COLORS = [
  "#128C7E", "#1D4ED8", "#7E22CE", "#B45309",
  "#DC2626", "#059669", "#D97706", "#6D28D9",
];

function avatarColor(name: string): string {
  let hash = 0;
  for (let i = 0; i < name.length; i++) hash = name.charCodeAt(i) + ((hash << 5) - hash);
  return AVATAR_COLORS[Math.abs(hash) % AVATAR_COLORS.length];
}

/* ─── Component ────────────────────────────────────────────── */
export function TicketListPanel({ tickets, selectedId, session, onSelect, onCreateNew }: Props) {
  const role = session.user.role;
  const myName = session.user.displayName;

  // Smart defaults: factory → show mine; logistics/admin → show all active
  const defaultStatus = (role === "logistics" || role === "admin") ? "open" : "";
  const defaultPerson = role === "factory_operator" ? "__mine__" : "";

  const [search, setSearch] = useState("");
  const [statusFilter, setStatusFilter] = useState(defaultStatus);
  const [personFilter, setPersonFilter] = useState(defaultPerson);
  const [showPersonFilter, setShowPersonFilter] = useState(false);
  const people = useMemo(() => derivePeople(tickets), [tickets]);

  const filtered = useMemo(() => tickets
    .filter((t) => {
      const q = search.toLowerCase();
      if (q && !t.title.toLowerCase().includes(q) &&
        !t.teamName.toLowerCase().includes(q) &&
        !t.factoryName.toLowerCase().includes(q) &&
        !t.requestOwner.toLowerCase().includes(q) &&
        !t.id.toLowerCase().includes(q)) return false;
      if (!matchesStatus(t, statusFilter)) return false;
      if (!matchesPerson(t, personFilter, myName)) return false;
      return true;
    })
    .sort((a, b) => {
      const at = latestTime(a);
      const bt = latestTime(b);
      return bt.localeCompare(at);
    }),
  [tickets, search, statusFilter, personFilter, myName]);

  const canCreate = role === "factory_operator" || role === "admin";
  const hasPersonFilter = personFilter !== "";

  return (
    <div className="ticket-list-pane">
      {/* Header */}
      <div style={{ padding: "10px 12px 8px", borderBottom: "1px solid var(--border)", flexShrink: 0, background: "var(--bg)" }}>
        <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 8 }}>
          <span style={{ fontSize: 11, fontWeight: 700, fontFamily: "var(--font-mono)", textTransform: "uppercase", letterSpacing: "0.06em", color: "var(--text-muted)" }}>
            Tickets
          </span>
          <div style={{ display: "flex", gap: 6, alignItems: "center" }}>
            {/* Person filter toggle */}
            <button
              onClick={() => setShowPersonFilter((v) => !v)}
              style={{
                padding: "3px 8px", fontSize: 10, fontWeight: 600, cursor: "pointer",
                border: `1px solid ${hasPersonFilter ? "var(--text-primary)" : "var(--border)"}`,
                background: hasPersonFilter ? "var(--text-primary)" : "transparent",
                color: hasPersonFilter ? "var(--action-text)" : "var(--text-secondary)",
                fontFamily: "var(--font-mono)", textTransform: "uppercase",
              }}
              title="Filter by person"
            >
              👤 {hasPersonFilter ? (personFilter === "__mine__" ? "Mine" : personFilter.split(" ")[0]) : "Person"}
            </button>
            {canCreate && (
              <button onClick={onCreateNew} className="btn btn-primary btn-sm" style={{ fontSize: 11, padding: "3px 10px" }}>
                + New
              </button>
            )}
          </div>
        </div>

        {/* Search */}
        <input
          type="text"
          className="input"
          placeholder="Search tickets, teams, factories…"
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          style={{ fontSize: 12, padding: "5px 8px" }}
        />
      </div>

      {/* Person filter panel */}
      {showPersonFilter && (
        <div style={{
          background: "var(--bg-subtle)", borderBottom: "1px solid var(--border)",
          padding: "8px 10px", flexShrink: 0,
        }}>
          <div style={{ fontSize: 9, color: "var(--text-muted)", textTransform: "uppercase", letterSpacing: "0.08em", fontFamily: "var(--font-mono)", marginBottom: 6 }}>
            Filter by person
          </div>
          <div style={{ display: "flex", flexWrap: "wrap", gap: 5 }}>
            {/* All */}
            <PersonChip
              label="All"
              active={personFilter === ""}
              onClick={() => { setPersonFilter(""); }}
            />
            {/* Mine */}
            <PersonChip
              label="Mine"
              active={personFilter === "__mine__"}
              color="#128C7E"
              initial={personInitial(myName)}
              onClick={() => setPersonFilter(personFilter === "__mine__" ? "" : "__mine__")}
            />
            {/* Each unique person */}
            {people.map((name) => (
              <PersonChip
                key={name}
                label={name}
                initial={personInitial(name)}
                color={avatarColor(name)}
                active={personFilter === name}
                onClick={() => setPersonFilter(personFilter === name ? "" : name)}
              />
            ))}
          </div>
        </div>
      )}

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
              flexShrink: 0, padding: "2px 8px", fontSize: 10,
              fontFamily: "var(--font-mono)",
              fontWeight: statusFilter === f.value ? 700 : 400,
              border: "1px solid",
              borderColor: statusFilter === f.value ? "var(--text-primary)" : "var(--border)",
              background: statusFilter === f.value ? "var(--text-primary)" : "var(--bg)",
              color: statusFilter === f.value ? "var(--action-text)" : "var(--text-secondary)",
              cursor: "pointer", letterSpacing: "0.02em", textTransform: "uppercase",
            }}
          >
            {f.label}
          </button>
        ))}
      </div>

      {/* Active filter summary */}
      {(hasPersonFilter || statusFilter) && (
        <div style={{
          padding: "4px 10px", background: "#fff8e6", borderBottom: "1px solid #fde68a",
          display: "flex", alignItems: "center", gap: 6, flexShrink: 0,
        }}>
          <span style={{ fontSize: 10, color: "#b45309", flex: 1 }}>
            {[
              statusFilter && `Status: ${STATUS_FILTERS.find((f) => f.value === statusFilter)?.label}`,
              personFilter === "__mine__" ? "Person: Mine" : personFilter ? `Person: ${personFilter}` : null,
            ].filter(Boolean).join(" · ")}
          </span>
          <button
            onClick={() => { setStatusFilter(""); setPersonFilter(""); }}
            style={{ fontSize: 10, color: "#b45309", background: "none", border: "none", cursor: "pointer", fontWeight: 700 }}
          >
            Clear all
          </button>
        </div>
      )}

      {/* Ticket list */}
      <div style={{ flex: 1, overflowY: "auto" }}>
        {filtered.length === 0 ? (
          <div className="empty-state" style={{ padding: "32px 16px" }}>
            <div className="empty-state-icon" style={{ fontSize: 28, marginBottom: 8 }}>
              {search ? "🔍" : role === "factory_operator" ? "📦" : role === "logistics" ? "🚚" : "📋"}
            </div>
            <div className="empty-state-title">
              {search ? "No results" : (search || statusFilter || personFilter) ? "No tickets match" : "No tickets yet"}
            </div>
            <div className="empty-state-desc">
              {search
                ? `Nothing matches "${search}".`
                : (statusFilter || personFilter)
                  ? "Try clearing the filters below."
                  : role === "factory_operator"
                    ? "Tap + New to request devices for your factory."
                    : role === "logistics"
                      ? "No open tickets right now. Check All status."
                      : "No tickets in the system yet."}
            </div>
            {(search || statusFilter || personFilter) && (
              <button
                onClick={() => { setSearch(""); setStatusFilter(""); setPersonFilter(""); }}
                style={{ marginTop: 12, fontSize: 12, color: "var(--text-secondary)", background: "none", border: "1px solid var(--border)", padding: "6px 14px", cursor: "pointer", borderRadius: 4 }}
              >
                Clear all filters
              </button>
            )}
            {!search && !statusFilter && !personFilter && role === "factory_operator" && (
              <button
                onClick={onCreateNew}
                style={{ marginTop: 12, fontSize: 12, fontWeight: 700, color: "var(--action-text)", background: "var(--action)", border: "none", padding: "8px 18px", cursor: "pointer", borderRadius: 4 }}
              >
                + Request Devices
              </button>
            )}
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
                    #{t.id.slice(0, 10)}
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

                {/* Row 2: team name + request owner */}
                <div style={{ display: "flex", alignItems: "center", gap: 6 }}>
                  <div style={{ fontSize: 12, fontWeight: 600, color: "var(--text-primary)", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap", flex: 1 }}>
                    {t.teamName}
                  </div>
                  {t.requestOwner && (
                    <span title={`Created by ${t.requestOwner}`} style={{
                      width: 18, height: 18, borderRadius: "50%", flexShrink: 0,
                      background: avatarColor(t.requestOwner),
                      display: "flex", alignItems: "center", justifyContent: "center",
                      fontSize: 9, fontWeight: 700, color: "#fff",
                    }}>
                      {personInitial(t.requestOwner)}
                    </span>
                  )}
                </div>

                {/* Row 3: factory + assignee badge */}
                <div style={{ display: "flex", alignItems: "center", gap: 4, overflow: "hidden" }}>
                  <span style={{ fontSize: 11, color: "var(--text-muted)", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap", flex: 1 }}>
                    {t.factoryName}
                    {lastMsg && !t.assignedToName && (
                      <span style={{ color: "var(--text-placeholder)" }}> · {lastMsg.message.slice(0, 28)}</span>
                    )}
                  </span>
                  {t.assignedToName ? (
                    <span
                      title={`Assigned to ${t.assignedToName}`}
                      style={{
                        fontSize: 9, padding: "1px 6px", flexShrink: 0,
                        background: `${avatarColor(t.assignedToName)}22`,
                        color: avatarColor(t.assignedToName),
                        border: `1px solid ${avatarColor(t.assignedToName)}44`,
                        borderRadius: 10, fontWeight: 700, whiteSpace: "nowrap",
                      }}
                    >
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
      <div style={{ padding: "6px 12px", borderTop: "1px solid var(--border)", flexShrink: 0, display: "flex", gap: 8, alignItems: "center" }}>
        <span style={{ fontSize: 10, color: "var(--text-muted)", fontFamily: "var(--font-mono)", flex: 1 }}>
          {filtered.length} of {tickets.length} tickets
        </span>
        {(hasPersonFilter || statusFilter || search) && (
          <button
            onClick={() => { setSearch(""); setStatusFilter(""); setPersonFilter(""); }}
            style={{ fontSize: 10, color: "var(--text-muted)", background: "none", border: "none", cursor: "pointer" }}
          >
            Clear
          </button>
        )}
      </div>
    </div>
  );
}

/* ─── Person chip ──────────────────────────────────────────── */
function PersonChip({
  label, initial, color, active, onClick,
}: {
  label: string; initial?: string; color?: string; active: boolean; onClick: () => void;
}) {
  return (
    <button
      onClick={onClick}
      style={{
        display: "flex", alignItems: "center", gap: 4,
        padding: "2px 8px 2px 4px", cursor: "pointer",
        border: `1px solid ${active ? (color ?? "var(--text-primary)") : "var(--border)"}`,
        background: active ? (color ? `${color}18` : "var(--bg-subtle)") : "transparent",
        borderRadius: 20, fontSize: 11, fontWeight: active ? 700 : 400,
        color: active ? (color ?? "var(--text-primary)") : "var(--text-secondary)",
      }}
    >
      {initial ? (
        <span style={{
          width: 16, height: 16, borderRadius: "50%", flexShrink: 0,
          background: active ? (color ?? "#128C7E") : "var(--border-strong)",
          display: "flex", alignItems: "center", justifyContent: "center",
          fontSize: 9, fontWeight: 800, color: "#fff",
        }}>
          {initial}
        </span>
      ) : null}
      {label.length > 14 ? label.slice(0, 12) + "…" : label}
    </button>
  );
}
