"use client";

import { useState } from "react";
import { updateAdminInventoryItem } from "@/lib/backend";
import type {
  AdminInventoryItem,
  AdminInventoryPatch,
  AuthSession,
  DashboardSnapshot,
  MovementRecord,
  TicketRecord,
} from "@/lib/operations-types";

type Props = {
  snapshot: DashboardSnapshot;
  session: AuthSession;
};

/* ─── helpers ─────────────────────────────────────────────── */

function statusBadge(status: string) {
  if (status === "critical") return <span className="badge badge-rejected">Critical</span>;
  if (status === "low_stock") return <span className="badge badge-ingestion_processing">Low Stock</span>;
  return <span className="badge badge-accepted">Healthy</span>;
}

function fmtDate(s: string) {
  try {
    return new Date(s).toLocaleDateString("en-GB", {
      day: "2-digit", month: "short", year: "numeric",
      hour: "2-digit", minute: "2-digit",
    });
  } catch { return s; }
}

function fmtDateShort(s: string) {
  try {
    return new Date(s).toLocaleDateString("en-GB", { day: "2-digit", month: "short", hour: "2-digit", minute: "2-digit" });
  } catch { return s; }
}

/** Outgoing = HQ dispatching to factory; Incoming = factory returning to HQ */
function detectDirection(r: MovementRecord): "outgoing" | "incoming" | "internal" {
  const src = (r.sourceLabel ?? "").toLowerCase();
  const dst = (r.destinationLabel ?? "").toLowerCase();
  if (src.includes("hq") || src.includes("headquarter")) return "outgoing";
  if (dst.includes("hq") || dst.includes("headquarter")) return "incoming";
  // fallback: check routePath
  const path = r.routePath ?? [];
  if (path[0]?.toLowerCase().includes("hq")) return "outgoing";
  if (path[path.length - 1]?.toLowerCase().includes("hq")) return "incoming";
  return "internal";
}

const ITEM_ICONS: Record<string, string> = {
  "SD Cards": "💾",
  "Devices": "📷",
  "Chargers / Hubs": "🔌",
  "Cables": "🔗",
};

/* Which item types does this movement contain? */
function hasItemType(r: MovementRecord, t: string): boolean {
  if (t === "SD Cards") return r.sdCardsCount > 0;
  if (t === "Devices") return r.devicesCount > 0;
  if (t === "Chargers / Hubs") return r.usbHubsCount > 0;
  if (t === "Cables") return r.cablesCount > 0;
  return false;
}

/* ─── Detail Modal ────────────────────────────────────────── */
function LogDetailModal({
  record,
  ticket,
  direction,
  onClose,
}: {
  record: MovementRecord;
  ticket: TicketRecord | null;
  direction: "outgoing" | "incoming" | "internal";
  onClose: () => void;
}) {
  const dirLabel = direction === "outgoing" ? "Outgoing (HQ → Factory)" : direction === "incoming" ? "Incoming (Factory → HQ)" : "Internal Transfer";
  const dirColor = direction === "outgoing" ? "#1d4ed8" : direction === "incoming" ? "#059669" : "#b45309";
  const dirBg = direction === "outgoing" ? "#eff6ff" : direction === "incoming" ? "#f0fdf4" : "#fffbeb";

  const items = [
    { label: "SD Cards", icon: "💾", count: record.sdCardsCount, key: "sdCards" },
    { label: "Camera Devices", icon: "📷", count: record.devicesCount, key: "devices" },
    { label: "Charger / USB Hubs", icon: "🔌", count: record.usbHubsCount, key: "hubs" },
    { label: "Cables / Wires", icon: "🔗", count: record.cablesCount, key: "cables" },
  ].filter((i) => i.count > 0);

  const pkgItems = ticket?.packages ?? [];

  return (
    <div
      style={{
        position: "fixed", inset: 0, zIndex: 200,
        background: "rgba(0,0,0,0.5)", display: "flex", alignItems: "center", justifyContent: "center",
        padding: 16,
      }}
      onClick={onClose}
    >
      <div
        style={{
          background: "#fff", borderRadius: 10, width: "100%", maxWidth: 520,
          maxHeight: "90vh", overflowY: "auto", boxShadow: "0 20px 60px rgba(0,0,0,0.25)",
        }}
        onClick={(e) => e.stopPropagation()}
      >
        {/* Modal header */}
        <div style={{ padding: "16px 20px 12px", borderBottom: "1px solid var(--border)", display: "flex", alignItems: "center", gap: 12 }}>
          <span style={{ fontSize: 28 }}>{direction === "outgoing" ? "📤" : direction === "incoming" ? "📥" : "↔️"}</span>
          <div style={{ flex: 1, minWidth: 0 }}>
            <div style={{ fontSize: 15, fontWeight: 700, color: "var(--text-primary)" }}>
              {ticket?.teamName ?? record.routeSummary ?? "Movement Detail"}
            </div>
            <div style={{ fontSize: 12, color: "var(--text-muted)", marginTop: 2 }}>
              {ticket?.factoryName && `${ticket.factoryName} · `}{fmtDate(record.lastEventAt)}
            </div>
          </div>
          <button
            onClick={onClose}
            style={{ background: "none", border: "none", fontSize: 20, cursor: "pointer", color: "var(--text-muted)", flexShrink: 0 }}
          >×</button>
        </div>

        <div style={{ padding: "16px 20px", display: "flex", flexDirection: "column", gap: 16 }}>
          {/* Direction pill */}
          <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
            <span style={{ padding: "4px 12px", borderRadius: 20, background: dirBg, color: dirColor, fontSize: 12, fontWeight: 700 }}>
              {dirLabel}
            </span>
            <span className={`badge badge-${record.status}`} style={{ fontSize: 11, padding: "4px 10px", borderRadius: 20 }}>
              {record.status.replace(/_/g, " ")}
            </span>
            <span style={{ padding: "4px 10px", borderRadius: 20, background: "var(--bg-subtle)", color: "var(--text-muted)", fontSize: 11 }}>
              {record.packageCount} package{record.packageCount !== 1 ? "s" : ""}
            </span>
          </div>

          {/* Route */}
          <div style={{ background: "var(--bg-subtle)", borderRadius: 8, padding: "10px 14px" }}>
            <div style={{ fontSize: 10, fontWeight: 700, color: "var(--text-muted)", textTransform: "uppercase", letterSpacing: "0.08em", marginBottom: 6 }}>
              Route
            </div>
            <div style={{ display: "flex", alignItems: "center", gap: 8, flexWrap: "wrap" }}>
              {(record.routePath?.length ?? 0) > 0
                ? record.routePath.map((step, i) => (
                  <span key={i} style={{ display: "flex", alignItems: "center", gap: 8 }}>
                    <span style={{ fontSize: 13, fontWeight: 600, color: "var(--text-primary)", background: "#fff", border: "1px solid var(--border)", borderRadius: 6, padding: "3px 10px" }}>
                      {step}
                    </span>
                    {i < record.routePath.length - 1 && (
                      <span style={{ fontSize: 16, color: "var(--text-muted)" }}>→</span>
                    )}
                  </span>
                ))
                : <span style={{ fontSize: 13, color: "var(--text-secondary)" }}>{record.sourceLabel} → {record.destinationLabel}</span>
              }
            </div>
          </div>

          {/* Item breakdown */}
          <div>
            <div style={{ fontSize: 10, fontWeight: 700, color: "var(--text-muted)", textTransform: "uppercase", letterSpacing: "0.08em", marginBottom: 8 }}>
              Items Moved
            </div>
            {items.length === 0 ? (
              <div style={{ fontSize: 13, color: "var(--text-muted)" }}>No item counts recorded.</div>
            ) : (
              <div style={{ display: "grid", gridTemplateColumns: "repeat(2, 1fr)", gap: 8 }}>
                {items.map((item) => (
                  <div key={item.key} style={{
                    display: "flex", alignItems: "center", gap: 10, padding: "10px 14px",
                    background: "var(--bg-subtle)", borderRadius: 8, border: "1px solid var(--border)",
                  }}>
                    <span style={{ fontSize: 20 }}>{item.icon}</span>
                    <div>
                      <div style={{ fontSize: 20, fontWeight: 800, color: "var(--text-primary)", lineHeight: 1 }}>{item.count}</div>
                      <div style={{ fontSize: 11, color: "var(--text-muted)", marginTop: 2 }}>{item.label}</div>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>

          {/* Package breakdown (if packages exist on ticket) */}
          {pkgItems.length > 0 && (
            <div>
              <div style={{ fontSize: 10, fontWeight: 700, color: "var(--text-muted)", textTransform: "uppercase", letterSpacing: "0.08em", marginBottom: 8 }}>
                Package Records
              </div>
              <div style={{ display: "flex", flexDirection: "column", gap: 6 }}>
                {pkgItems.map((pkg) => (
                  <div key={pkg.packageCode} style={{
                    display: "flex", alignItems: "center", gap: 10, padding: "8px 12px",
                    border: "1px solid var(--border)", borderRadius: 6, background: "#fff",
                    fontSize: 12,
                  }}>
                    <span style={{ fontSize: 16 }}>{pkg.direction === "outbound" ? "📤" : "📥"}</span>
                    <div style={{ flex: 1, minWidth: 0 }}>
                      <div style={{ fontWeight: 600, fontFamily: "var(--font-mono)", color: "var(--text-primary)" }}>{pkg.packageCode}</div>
                      <div style={{ fontSize: 10, color: "var(--text-muted)", marginTop: 1 }}>
                        {[
                          pkg.shippedDevicesCount && `${pkg.shippedDevicesCount} devices`,
                          pkg.shippedSdCardsCount && `${pkg.shippedSdCardsCount} SD cards`,
                          pkg.shippedUsbHubsCount && `${pkg.shippedUsbHubsCount} hubs`,
                          pkg.shippedCablesCount && `${pkg.shippedCablesCount} cables`,
                        ].filter(Boolean).join(" · ")}
                      </div>
                    </div>
                    <span className={`badge badge-${pkg.status}`} style={{ fontSize: 9 }}>{pkg.status.replace(/_/g, " ")}</span>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* Ticket context */}
          {ticket && (
            <div style={{ borderTop: "1px solid var(--border)", paddingTop: 12 }}>
              <div style={{ fontSize: 10, fontWeight: 700, color: "var(--text-muted)", textTransform: "uppercase", letterSpacing: "0.08em", marginBottom: 6 }}>
                Linked Ticket
              </div>
              <div style={{ display: "flex", flexDirection: "column", gap: 4 }}>
                {[
                  { label: "Team", value: ticket.teamName },
                  { label: "Factory", value: ticket.factoryName },
                  { label: "Requested By", value: ticket.requestOwner },
                  { label: "Devices Requested", value: String(ticket.devicesRequested) },
                  { label: "SD Cards Requested", value: String(ticket.sdCardsRequested) },
                  { label: "Deployment Date", value: ticket.deploymentDate },
                  { label: "Ticket ID", value: `#${record.ticketId.slice(0, 12)}` },
                ].map(({ label, value }) => (
                  <div key={label} style={{ display: "flex", gap: 10, fontSize: 12 }}>
                    <span style={{ color: "var(--text-muted)", minWidth: 130 }}>{label}</span>
                    <span style={{ color: "var(--text-primary)", fontWeight: 500 }}>{value}</span>
                  </div>
                ))}
              </div>
            </div>
          )}

          {record.note && (
            <div style={{ background: "#fffbeb", border: "1px solid #fde68a", borderRadius: 6, padding: "8px 12px", fontSize: 12, color: "#92400e" }}>
              <strong>Note:</strong> {record.note}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

/* ─── Activity Log ────────────────────────────────────────── */
const DIRECTION_FILTERS = [
  { label: "All", value: "" },
  { label: "📤 Outgoing", value: "outgoing" },
  { label: "📥 Incoming", value: "incoming" },
];
const ITEM_FILTERS = ["All", "SD Cards", "Devices", "Chargers / Hubs", "Cables"];

function ActivityLog({ history, tickets }: { history: MovementRecord[]; tickets: TicketRecord[] }) {
  const [dirFilter, setDirFilter] = useState("");
  const [itemFilter, setItemFilter] = useState("All");
  const [selected, setSelected] = useState<MovementRecord | null>(null);

  // Build a quick lookup: ticketId → TicketRecord
  const ticketMap = new Map(tickets.map((t) => [t.id, t]));

  // Attach direction & team info
  const enriched = history.map((r) => ({
    record: r,
    direction: detectDirection(r),
    ticket: ticketMap.get(r.ticketId) ?? null,
  }));

  // Filter
  const filtered = enriched.filter(({ direction, record }) => {
    if (dirFilter && direction !== dirFilter) return false;
    if (itemFilter !== "All" && !hasItemType(record, itemFilter)) return false;
    return true;
  });

  // Sort newest first
  filtered.sort((a, b) => b.record.lastEventAt.localeCompare(a.record.lastEventAt));

  const selectedTicket = selected ? (ticketMap.get(selected.ticketId) ?? null) : null;
  const selectedDirection = selected ? detectDirection(selected) : "outgoing";

  return (
    <div style={{ display: "flex", flexDirection: "column", height: "100%", overflow: "hidden" }}>
      {/* Section header with filters */}
      <div style={{
        padding: "10px 14px 8px", borderBottom: "1px solid var(--border)",
        background: "var(--bg)", flexShrink: 0,
      }}>
        <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 8, flexWrap: "wrap", gap: 6 }}>
          <span style={{ fontSize: 11, fontWeight: 700, color: "var(--text-muted)", fontFamily: "var(--font-mono)", textTransform: "uppercase", letterSpacing: "0.06em" }}>
            Recent Activity Log
          </span>
          <span style={{ fontSize: 10, color: "var(--text-muted)" }}>{filtered.length} of {history.length} records</span>
        </div>

        {/* Direction chips */}
        <div style={{ display: "flex", gap: 5, flexWrap: "wrap", marginBottom: 6 }}>
          {DIRECTION_FILTERS.map((f) => (
            <button
              key={f.value}
              onClick={() => setDirFilter(f.value)}
              style={{
                padding: "3px 10px", fontSize: 11, cursor: "pointer", border: "1px solid",
                borderColor: dirFilter === f.value ? "var(--text-primary)" : "var(--border)",
                background: dirFilter === f.value ? "var(--text-primary)" : "transparent",
                color: dirFilter === f.value ? "#fff" : "var(--text-secondary)",
                fontWeight: dirFilter === f.value ? 700 : 400, borderRadius: 20,
              }}
            >{f.label}</button>
          ))}
          <div style={{ width: 1, background: "var(--border)", margin: "0 2px" }} />
          {ITEM_FILTERS.map((f) => (
            <button
              key={f}
              onClick={() => setItemFilter(f)}
              style={{
                padding: "3px 10px", fontSize: 11, cursor: "pointer", border: "1px solid",
                borderColor: itemFilter === f ? "var(--text-primary)" : "var(--border)",
                background: itemFilter === f ? "var(--text-primary)" : "transparent",
                color: itemFilter === f ? "#fff" : "var(--text-secondary)",
                fontWeight: itemFilter === f ? 700 : 400, borderRadius: 20,
                display: "flex", alignItems: "center", gap: 4,
              }}
            >
              {f !== "All" && <span>{ITEM_ICONS[f]}</span>}
              {f}
            </button>
          ))}
        </div>
      </div>

      {/* Log list */}
      <div style={{ flex: 1, overflowY: "auto" }}>
        {filtered.length === 0 ? (
          <div className="empty-state" style={{ padding: "24px 16px" }}>
            <div style={{ fontSize: 28, marginBottom: 8 }}>📭</div>
            <div className="empty-state-title">No activity matches</div>
            <div className="empty-state-desc">Try changing the direction or item type filter.</div>
            {(dirFilter || itemFilter !== "All") && (
              <button
                onClick={() => { setDirFilter(""); setItemFilter("All"); }}
                style={{ marginTop: 10, fontSize: 12, color: "var(--text-secondary)", background: "none", border: "1px solid var(--border)", padding: "5px 12px", cursor: "pointer", borderRadius: 4 }}
              >Clear filters</button>
            )}
          </div>
        ) : (
          filtered.map(({ record, direction, ticket }) => {
            const dir = direction;
            const dirColor = dir === "outgoing" ? "#1d4ed8" : dir === "incoming" ? "#059669" : "#b45309";
            const dirBg = dir === "outgoing" ? "#eff6ff" : dir === "incoming" ? "#f0fdf4" : "#fffbeb";
            const dirIcon = dir === "outgoing" ? "📤" : dir === "incoming" ? "📥" : "↔️";

            const counts = [
              record.sdCardsCount > 0 && { icon: "💾", label: "SD", n: record.sdCardsCount },
              record.devicesCount > 0 && { icon: "📷", label: "Dev", n: record.devicesCount },
              record.usbHubsCount > 0 && { icon: "🔌", label: "Hub", n: record.usbHubsCount },
              record.cablesCount > 0 && { icon: "🔗", label: "Cable", n: record.cablesCount },
            ].filter(Boolean) as { icon: string; label: string; n: number }[];

            return (
              <div
                key={record.id}
                onClick={() => setSelected(record)}
                style={{
                  padding: "10px 14px", borderBottom: "1px solid var(--border)",
                  cursor: "pointer", display: "flex", alignItems: "flex-start", gap: 12,
                  transition: "background 0.1s",
                }}
                onMouseEnter={(e) => (e.currentTarget.style.background = "var(--bg-subtle)")}
                onMouseLeave={(e) => (e.currentTarget.style.background = "")}
              >
                {/* Direction icon */}
                <div style={{
                  width: 36, height: 36, borderRadius: 8, background: dirBg,
                  display: "flex", alignItems: "center", justifyContent: "center",
                  fontSize: 18, flexShrink: 0, border: `1px solid ${dirColor}22`,
                }}>
                  {dirIcon}
                </div>

                <div style={{ flex: 1, minWidth: 0 }}>
                  {/* Line 1: team + direction pill */}
                  <div style={{ display: "flex", alignItems: "center", gap: 6, marginBottom: 3 }}>
                    <span style={{ fontSize: 13, fontWeight: 700, color: "var(--text-primary)", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap", flex: 1 }}>
                      {ticket?.teamName ?? record.routeSummary ?? `Ticket #${record.ticketId.slice(0, 8)}`}
                    </span>
                    <span style={{ fontSize: 10, padding: "1px 8px", borderRadius: 12, background: dirBg, color: dirColor, fontWeight: 700, flexShrink: 0 }}>
                      {dir === "outgoing" ? "OUT" : dir === "incoming" ? "IN" : "INTERNAL"}
                    </span>
                  </div>

                  {/* Line 2: factory + route */}
                  <div style={{ fontSize: 11, color: "var(--text-muted)", marginBottom: 5, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
                    {ticket?.factoryName && `${ticket.factoryName} · `}
                    {record.sourceLabel} → {record.destinationLabel}
                  </div>

                  {/* Line 3: item count chips */}
                  <div style={{ display: "flex", gap: 5, flexWrap: "wrap" }}>
                    {counts.map((c) => (
                      <span key={c.label} style={{
                        fontSize: 10, padding: "2px 8px", borderRadius: 12,
                        background: "var(--bg-muted)", color: "var(--text-secondary)",
                        border: "1px solid var(--border)", fontFamily: "var(--font-mono)",
                        display: "flex", alignItems: "center", gap: 3,
                      }}>
                        {c.icon} {c.n} {c.label}
                      </span>
                    ))}
                    {counts.length === 0 && (
                      <span style={{ fontSize: 10, color: "var(--text-muted)" }}>No item counts</span>
                    )}
                  </div>
                </div>

                {/* Right: date + tap hint */}
                <div style={{ flexShrink: 0, textAlign: "right" }}>
                  <div style={{ fontSize: 10, color: "var(--text-muted)", fontFamily: "var(--font-mono)" }}>
                    {fmtDateShort(record.lastEventAt)}
                  </div>
                  <div style={{ fontSize: 9, color: "var(--text-placeholder)", marginTop: 4 }}>tap for details</div>
                </div>
              </div>
            );
          })
        )}
      </div>

      {/* Detail modal */}
      {selected && (
        <LogDetailModal
          record={selected}
          ticket={selectedTicket}
          direction={selectedDirection}
          onClose={() => setSelected(null)}
        />
      )}
    </div>
  );
}

/* ─── Main Component ──────────────────────────────────────── */
export function InventoryWorkspace({ snapshot, session }: Props) {
  const [items, setItems] = useState<AdminInventoryItem[]>(snapshot.inventoryItems ?? []);
  const [editId, setEditId] = useState<string | null>(null);
  const [patch, setPatch] = useState<AdminInventoryPatch & { note: string }>({
    totalUnits: 0, availableUnits: 0, allocatedUnits: 0,
    inTransitUnits: 0, ingestionUnits: 0, missingUnits: 0,
    reorderPoint: 0, location: "", updatedBy: "", note: "",
  });
  const [saving, setSaving] = useState(false);
  const [saveError, setSaveError] = useState("");

  const history = snapshot.movementHistory ?? [];
  const tickets = snapshot.tickets ?? [];

  const editItem = items.find((i) => i.id === editId) ?? null;
  const canEdit = session.user.role === "admin" || session.user.role === "logistics";

  function openEdit(item: AdminInventoryItem) {
    setEditId(item.id);
    setSaveError("");
    setPatch({
      totalUnits: item.totalUnits,
      availableUnits: item.availableUnits,
      allocatedUnits: item.allocatedUnits,
      inTransitUnits: item.inTransitUnits,
      ingestionUnits: item.ingestionUnits,
      missingUnits: item.missingUnits,
      reorderPoint: item.reorderPoint,
      location: item.location,
      updatedBy: session.user.displayName,
      note: item.note ?? "",
    });
  }

  async function handleSave() {
    if (!editId) return;
    setSaving(true);
    setSaveError("");
    try {
      const updated = await updateAdminInventoryItem(editId, patch, session);
      if (updated) {
        setItems((prev) => prev.map((i) => (i.id === updated.id ? updated : i)));
        setEditId(null);
      }
    } catch (err) {
      setSaveError(err instanceof Error ? err.message : "Save failed.");
    } finally {
      setSaving(false);
    }
  }

  const totalMissing = items.reduce((s, i) => s + i.missingUnits, 0);

  return (
    <div style={{ height: "100%", display: "flex", flexDirection: "column", overflow: "hidden" }}>
      {/* Header */}
      <div className="workspace-header">
        <div style={{ fontSize: 13, fontWeight: 700 }}>Inventory</div>
        <div style={{ marginLeft: "auto", display: "flex", gap: 16, fontSize: 11, color: "var(--text-muted)" }}>
          <span>{items.length} item types</span>
          {totalMissing > 0 && (
            <span style={{ color: "var(--error)", fontWeight: 700 }}>⚠ {totalMissing} missing units</span>
          )}
        </div>
      </div>

      {/* Body: top table + bottom log (split vertically) */}
      <div style={{ flex: 1, overflow: "hidden", display: "flex", flexDirection: "column" }}>

        {/* ── Top: Stock Table ── */}
        <div style={{ flex: "0 0 auto", display: "flex", borderBottom: "2px solid var(--border)", maxHeight: "45%", overflow: "hidden" }}>
          <div style={{ flex: 1, overflowX: "auto", overflowY: "auto" }}>
            <table className="data-table" style={{ minWidth: 700 }}>
              <thead style={{ position: "sticky", top: 0, background: "var(--bg)", zIndex: 1 }}>
                <tr>
                  <th>Item Type</th>
                  <th>SKU</th>
                  <th>Total</th>
                  <th>Available</th>
                  <th>Allocated</th>
                  <th>In Transit</th>
                  <th>Ingestion</th>
                  <th>Missing</th>
                  <th>Status</th>
                  <th>Location</th>
                  {canEdit && <th></th>}
                </tr>
              </thead>
              <tbody>
                {items.length === 0 ? (
                  <tr>
                    <td colSpan={11} style={{ textAlign: "center", padding: 32, color: "var(--text-muted)" }}>
                      No inventory items found.
                    </td>
                  </tr>
                ) : (
                  items.map((item) => (
                    <tr key={item.id} style={{ background: editId === item.id ? "var(--bg-muted)" : undefined }}>
                      <td style={{ fontWeight: 600 }}>{item.itemType}</td>
                      <td className="mono" style={{ fontSize: 11, color: "var(--text-muted)" }}>{item.sku}</td>
                      <td className="mono">{item.totalUnits}</td>
                      <td className="mono" style={{ color: item.availableUnits <= item.reorderPoint ? "var(--warning)" : undefined }}>
                        {item.availableUnits}
                      </td>
                      <td className="mono">{item.allocatedUnits}</td>
                      <td className="mono">{item.inTransitUnits}</td>
                      <td className="mono">{item.ingestionUnits}</td>
                      <td className="mono" style={{ color: item.missingUnits > 0 ? "var(--error)" : "var(--text-muted)", fontWeight: item.missingUnits > 0 ? 700 : 400 }}>
                        {item.missingUnits > 0 ? item.missingUnits : "—"}
                      </td>
                      <td>{statusBadge(item.status)}</td>
                      <td style={{ fontSize: 11, color: "var(--text-secondary)" }}>{item.location || "—"}</td>
                      {canEdit && (
                        <td>
                          <button onClick={() => openEdit(item)} className="btn btn-secondary btn-xs" style={{ fontSize: 10 }}>
                            Edit
                          </button>
                        </td>
                      )}
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>

          {/* Edit panel */}
          {editItem && (
            <div style={{ width: 280, borderLeft: "1px solid var(--border)", background: "var(--bg)", overflowY: "auto", flexShrink: 0 }}>
              <div className="panel-header">
                <span className="panel-title">Edit · {editItem.itemType}</span>
                <button onClick={() => setEditId(null)} style={{ fontSize: 16, color: "var(--text-muted)", background: "none", border: "none", cursor: "pointer" }}>×</button>
              </div>
              <div style={{ padding: "14px", display: "flex", flexDirection: "column", gap: 10 }}>
                {saveError && <div className="alert alert-error" style={{ fontSize: 11, padding: "5px 8px" }}>{saveError}</div>}
                {[
                  { key: "totalUnits", label: "Total Units" },
                  { key: "availableUnits", label: "Available" },
                  { key: "allocatedUnits", label: "Allocated" },
                  { key: "inTransitUnits", label: "In Transit" },
                  { key: "ingestionUnits", label: "In Ingestion" },
                  { key: "missingUnits", label: "Missing" },
                  { key: "reorderPoint", label: "Reorder Point" },
                ].map(({ key, label }) => (
                  <div className="form-group" key={key}>
                    <label className="form-label" style={{ fontSize: 10 }}>{label}</label>
                    <input
                      type="number"
                      className="input"
                      style={{ fontSize: 13, fontFamily: "var(--font-mono)" }}
                      min={0}
                      value={(patch as Record<string, unknown>)[key] as number}
                      onChange={(e) => setPatch((p) => ({ ...p, [key]: parseInt(e.target.value, 10) || 0 }))}
                    />
                  </div>
                ))}
                <div className="form-group">
                  <label className="form-label" style={{ fontSize: 10 }}>Location</label>
                  <input className="input" style={{ fontSize: 12 }} value={patch.location} onChange={(e) => setPatch((p) => ({ ...p, location: e.target.value }))} />
                </div>
                <div className="form-group">
                  <label className="form-label" style={{ fontSize: 10 }}>Update Note</label>
                  <textarea className="textarea" style={{ fontSize: 12, minHeight: 56 }} value={patch.note} onChange={(e) => setPatch((p) => ({ ...p, note: e.target.value }))} placeholder="Reason for update..." />
                </div>
                <div style={{ display: "flex", gap: 6 }}>
                  <button onClick={() => void handleSave()} className="btn btn-primary" disabled={saving} style={{ flex: 1, fontSize: 12 }}>
                    {saving ? "Saving..." : "Save"}
                  </button>
                  <button onClick={() => setEditId(null)} className="btn btn-secondary" style={{ fontSize: 12 }}>Cancel</button>
                </div>
              </div>
            </div>
          )}
        </div>

        {/* ── Bottom: Activity Log ── */}
        <div style={{ flex: 1, overflow: "hidden", minHeight: 0 }}>
          <ActivityLog history={history} tickets={tickets} />
        </div>
      </div>
    </div>
  );
}
