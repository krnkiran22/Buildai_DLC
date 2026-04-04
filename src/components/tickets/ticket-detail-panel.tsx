"use client";

import { useState } from "react";
import {
  addTicketMember,
  claimTicket,
  closeTicket,
  createTicketPackagesBatch,
  isSessionExpiredError,
  lookupUserByEmail,
  qrSvgUrl,
  removeTicketMember,
  updateTicketStatus,
} from "@/lib/backend";
import type {
  AuthSession,
  PackageBatchCreateInput,
  TicketMember,
  TicketRecord,
  TicketStatus,
  UserProfile,
} from "@/lib/operations-types";

/* ─── Ticket stages ────────────────────────────────────── */
const STAGES: { status: TicketStatus; label: string; icon: string }[] = [
  { status: "open",                    label: "Request Opened",          icon: "○" },
  { status: "accepted",                label: "Accepted by Logistics",   icon: "✓" },
  { status: "outbound_shipped",        label: "Shipped to Factory",      icon: "📦" },
  { status: "factory_received",        label: "Received at Factory",     icon: "🏭" },
  { status: "return_shipped",          label: "Return Shipped to HQ",    icon: "🔁" },
  { status: "hq_received",             label: "Received at HQ",          icon: "🏢" },
  { status: "transferred_to_ingestion",label: "Sent to Ingestion",       icon: "→" },
  { status: "ingestion_processing",    label: "SD Cards Processing",     icon: "⚙" },
  { status: "ingestion_completed",     label: "Ingestion Done",          icon: "✅" },
  { status: "closed",                  label: "Ticket Closed",           icon: "◼" },
];

const ORDER = STAGES.map((s) => s.status);

/* ─── Actions per role + status ───────────────────────── */
type Action = {
  label: string;
  sublabel?: string;
  targetStatus: TicketStatus;
  variant: "primary" | "secondary" | "danger" | "accept" | "reject";
  needsCarrier?: boolean;
};

function getActions(role: string, status: TicketStatus): Action[] {
  const a: Action[] = [];

  if (role === "logistics" || role === "admin") {
    if (status === "open") {
      a.push({ label: "Accept Request", sublabel: "Confirm you have stock", targetStatus: "accepted", variant: "accept" });
      a.push({ label: "Reject Request", sublabel: "Decline this request", targetStatus: "rejected", variant: "reject" });
    }
    if (status === "accepted") {
      a.push({ label: "Ship to Factory", sublabel: "Mark as dispatched", targetStatus: "outbound_shipped", variant: "primary", needsCarrier: true });
    }
    if (status === "return_shipped") {
      a.push({ label: "HQ Received Return", sublabel: "Package arrived at HQ", targetStatus: "hq_received", variant: "primary" });
    }
    if (status === "hq_received") {
      a.push({ label: "Send to Ingestion Team", sublabel: "Transfer SD cards for processing", targetStatus: "transferred_to_ingestion", variant: "primary" });
    }
    if (!["closed", "rejected"].includes(status)) {
      a.push({ label: "Close Ticket", sublabel: "", targetStatus: "closed", variant: "danger" });
    }
  }

  if (role === "factory_operator" || role === "admin") {
    if (status === "outbound_shipped") {
      a.push({ label: "I've Received the Shipment", sublabel: "Confirm delivery at factory", targetStatus: "factory_received", variant: "primary" });
    }
    if (status === "factory_received") {
      a.push({ label: "Ship Return to HQ", sublabel: "Mark return as dispatched", targetStatus: "return_shipped", variant: "primary", needsCarrier: true });
    }
  }

  if (role === "ingestion" || role === "admin") {
    if (status === "transferred_to_ingestion") {
      a.push({ label: "Start Processing SD Cards", sublabel: "Begin ingestion", targetStatus: "ingestion_processing", variant: "primary" });
    }
    if (status === "ingestion_processing") {
      a.push({ label: "Mark Ingestion Done", sublabel: "Processing completed", targetStatus: "ingestion_completed", variant: "primary" });
    }
    if (!["closed", "rejected"].includes(status) && role === "ingestion") {
      a.push({ label: "Close Ticket", sublabel: "", targetStatus: "closed", variant: "danger" });
    }
  }

  return a;
}

/* ─── Carrier options ──────────────────────────────────── */
const CARRIERS = ["", "DTDC", "Porter", "FedEx", "BlueDart", "Delhivery", "Ecom Express", "Xpressbees", "DHL", "Other / Hand Delivery"];

/* ─── Component ────────────────────────────────────────── */
type Props = {
  ticket: TicketRecord;
  session: AuthSession;
  onTicketUpdated: (ticket: TicketRecord) => void;
};

export function TicketDetailPanel({ ticket, session, onTicketUpdated }: Props) {
  const role = session.user.role;
  const [activeTab, setActiveTab] = useState<"tracker" | "details" | "packets" | "members">("tracker");
  const [claiming, setClaiming] = useState(false);
  const [actionLoading, setActionLoading] = useState<string | null>(null);
  const [actionError, setActionError] = useState("");

  /* Carrier modal */
  const [pendingAction, setPendingAction] = useState<Action | null>(null);
  const [carrier, setCarrier] = useState("");
  const [trackingNo, setTrackingNo] = useState("");
  const [carrierNote, setCarrierNote] = useState("");

  /* Close confirm */
  const [showClose, setShowClose] = useState(false);
  const [closeNote, setCloseNote] = useState("");

  /* QR batch */
  const [showQrForm, setShowQrForm] = useState(false);
  const [qrBatch, setQrBatch] = useState<PackageBatchCreateInput>({
    labelCount: 1, shippedSdCardsCount: 0, shippedDevicesCount: 0,
    shippedUsbHubsCount: 0, shippedCablesCount: 0, note: "",
  });
  const [qrLoading, setQrLoading] = useState(false);
  const [qrError, setQrError] = useState("");

  const currentIdx = ORDER.indexOf(ticket.status);
  const actions = getActions(role, ticket.status);
  const canGenerateQr = (role === "logistics" || role === "admin") &&
    ["accepted", "outbound_shipped"].includes(ticket.status);

  /* ── Execute action ── */
  async function executeAction(action: Action, note?: string) {
    setActionLoading(action.targetStatus);
    setActionError("");
    try {
      const updated = await updateTicketStatus(ticket.id, {
        status: action.targetStatus,
        note: note || undefined,
      }, session);
      if (updated) onTicketUpdated(updated);
      setPendingAction(null);
      setCarrier(""); setTrackingNo(""); setCarrierNote("");
    } catch (err) {
      if (isSessionExpiredError(err)) {
        setActionError("Your session has expired. Redirecting to login…");
      } else {
        setActionError(err instanceof Error ? err.message : "Action failed.");
      }
    } finally {
      setActionLoading(null);
    }
  }

  function handleActionClick(action: Action) {
    if (action.targetStatus === "closed") { setShowClose(true); return; }
    if (action.needsCarrier) { setPendingAction(action); return; }
    void executeAction(action);
  }

  async function handleCarrierSubmit() {
    if (!pendingAction) return;
    const noteParts = [];
    if (carrier) noteParts.push(`Carrier: ${carrier}`);
    if (trackingNo) noteParts.push(`Tracking: ${trackingNo}`);
    if (carrierNote) noteParts.push(carrierNote);
    await executeAction(pendingAction, noteParts.join(" | ") || undefined);
  }

  async function handleClose() {
    setActionLoading("closed");
    setActionError("");
    try {
      const updated = await closeTicket(ticket.id, closeNote, session);
      if (updated) onTicketUpdated(updated);
      setShowClose(false); setCloseNote("");
    } catch (err) {
      if (isSessionExpiredError(err)) {
        setActionError("Your session has expired. Redirecting to login…");
      } else {
        setActionError(err instanceof Error ? err.message : "Close failed.");
      }
    } finally { setActionLoading(null); }
  }

  async function handleGenerateQr() {
    if (qrBatch.labelCount < 1) { setQrError("Enter at least 1 label."); return; }
    setQrLoading(true); setQrError("");
    try {
      const updated = await createTicketPackagesBatch(ticket.id, qrBatch, session);
      if (updated) { onTicketUpdated(updated); setShowQrForm(false); }
    } catch (err) {
      setQrError(isSessionExpiredError(err) ? "Session expired. Please log in again." : (err instanceof Error ? err.message : "QR generation failed."));
    } finally { setQrLoading(false); }
  }

  function fmtDate(s: string) {
    try { return new Date(s).toLocaleDateString("en-GB", { day: "2-digit", month: "short", year: "numeric" }); } catch { return s; }
  }

  const mainActions = actions.filter((a) => a.variant !== "danger");
  const dangerActions = actions.filter((a) => a.variant === "danger");

  return (
    <div
      className="ticket-detail-pane"
      style={{
        background: "#ffffff",
        display: "flex", flexDirection: "column", overflow: "hidden",
        borderLeft: "1px solid #e9edef",
      }}
    >
      {/* ── Ticket Title — read-only, always visible at the top ── */}
      <div style={{
        padding: "10px 14px 8px",
        borderBottom: "1px solid #f0f2f5",
        flexShrink: 0,
        background: "#fafafa",
      }}>
        <div style={{
          fontSize: 9, fontFamily: "var(--font-mono)", textTransform: "uppercase",
          letterSpacing: "0.08em", color: "#8696a0", marginBottom: 4,
        }}>
          Ticket Title
        </div>
        <div style={{
          width: "100%", padding: "7px 10px",
          background: "#f0f2f5", border: "1px solid #e9edef", borderRadius: 6,
          fontSize: 12, fontFamily: "var(--font-mono)", fontWeight: 600,
          color: "#111b21", lineHeight: 1.4,
          userSelect: "text", pointerEvents: "none",
          wordBreak: "break-word",
        }}>
          {ticket.title || `Ticket #${ticket.id.slice(0, 8).toUpperCase()}`}
        </div>
      </div>

      {/* Tab strip — bigger touch targets */}
      <div style={{
        display: "flex", borderBottom: "1px solid #e9edef", flexShrink: 0,
        overflowX: "auto",
      }}>
        {(["tracker", "members", "details", "packets"] as const).map((tab) => {
          const isActive = activeTab === tab;
          const label = tab === "members"
            ? `Members${(ticket.members?.length ?? 0) > 0 ? ` (${ticket.members.length})` : ""}`
            : tab.charAt(0).toUpperCase() + tab.slice(1);
          return (
            <button
              key={tab}
              onClick={() => setActiveTab(tab)}
              style={{
                flex: "1 0 auto", padding: "12px 8px",
                fontSize: 11, fontFamily: "var(--font-mono)",
                textTransform: "uppercase", letterSpacing: "0.05em", cursor: "pointer",
                border: "none",
                borderBottom: `2.5px solid ${isActive ? "#128C7E" : "transparent"}`,
                background: "#fff",
                color: isActive ? "#128C7E" : "#8696a0",
                fontWeight: isActive ? 700 : 500,
                transition: "color 0.15s, border-color 0.15s",
                WebkitTapHighlightColor: "transparent",
                minWidth: 70,
                whiteSpace: "nowrap",
              }}
            >
              {label}
            </button>
          );
        })}
      </div>

      <div style={{ flex: 1, overflowY: "auto" }}>

        {/* ─── TRACKER TAB ─── */}
        {activeTab === "tracker" && (
          <div style={{ padding: "16px 14px 80px" }}>
            {/* Vertical stepper */}
            <div style={{ marginBottom: 20 }}>
              {STAGES.filter((s) => s.status !== "rejected" || ticket.status === "rejected").map((stage, i) => {
                if (ticket.status === "rejected" && stage.status !== "rejected") return null;
                const stageIdx = ORDER.indexOf(stage.status);
                const isDone = currentIdx > stageIdx;
                const isCurrent = ticket.status === stage.status;
                const isPending = currentIdx < stageIdx;
                const isLast = i === STAGES.length - 1;

                return (
                  <div key={stage.status} style={{ display: "flex", gap: 10, position: "relative", paddingBottom: isLast ? 0 : 16 }}>
                    {/* Dot + line */}
                    <div style={{ display: "flex", flexDirection: "column", alignItems: "center", minWidth: 14 }}>
                      <div style={{
                        width: isCurrent ? 14 : 10, height: isCurrent ? 14 : 10,
                        borderRadius: "50%", flexShrink: 0,
                        background: isDone ? "#128C7E" : isCurrent ? "#fff" : "#e9edef",
                        border: isCurrent ? "2.5px solid #128C7E" : isDone ? "none" : "2px solid #c8d0d8",
                        marginTop: isCurrent ? 1 : 3,
                        boxShadow: isCurrent ? "0 0 0 3px rgba(18,140,126,0.15)" : "none",
                        zIndex: 1,
                      }} />
                      {!isLast && (
                        <div style={{
                          width: 1.5, flex: 1, marginTop: 3,
                          background: isDone ? "#128C7E" : "#e9edef",
                        }} />
                      )}
                    </div>
                    {/* Label */}
                    <div style={{ flex: 1, paddingTop: 0 }}>
                      <div style={{
                        fontSize: 12, fontWeight: isCurrent ? 700 : 500,
                        color: isPending ? "#c8d0d8" : isCurrent ? "#111b21" : "#667781",
                      }}>
                        {stage.icon} {stage.label}
                      </div>
                      {isCurrent && (
                        <div style={{ fontSize: 10, color: "#128C7E", marginTop: 2, fontWeight: 600 }}>
                          ● Current stage
                        </div>
                      )}
                    </div>
                  </div>
                );
              })}

              {ticket.status === "rejected" && (
                <div style={{ display: "flex", gap: 10 }}>
                  <div style={{ width: 10, height: 10, borderRadius: "50%", background: "#dc2626", marginTop: 3 }} />
                  <div style={{ fontSize: 12, fontWeight: 700, color: "#dc2626" }}>✕ Rejected</div>
                </div>
              )}
            </div>

            {/* ── Assignment card ── */}
            {(() => {
              const canClaim = ["logistics", "admin"].includes(role) && ticket.status !== "closed" && ticket.status !== "rejected";
              const isMyTicket = ticket.assignedToEmail && ticket.assignedToEmail === session.user.email;
              if (!canClaim && !ticket.assignedToName) return null;
              return (
                <div style={{
                  marginBottom: 14, padding: "10px 12px",
                  background: ticket.assignedToName ? "#f0fdf4" : "#fffbeb",
                  border: `1px solid ${ticket.assignedToName ? "#bbf7d0" : "#fde68a"}`,
                  display: "flex", alignItems: "center", gap: 10,
                }}>
                  <div style={{ flex: 1 }}>
                    {ticket.assignedToName ? (
                      <>
                        <div style={{ fontSize: 10, color: "#667781", fontWeight: 600, textTransform: "uppercase", letterSpacing: "0.05em", marginBottom: 1 }}>
                          Assigned To
                        </div>
                        <div style={{ fontSize: 12, fontWeight: 700, color: "#111b21" }}>
                          {ticket.assignedToName}{isMyTicket ? " (you)" : ""}
                        </div>
                      </>
                    ) : (
                      <div style={{ fontSize: 12, color: "#b45309", fontWeight: 600 }}>
                        Unassigned — claim to handle this ticket
                      </div>
                    )}
                  </div>
                  {canClaim && !isMyTicket && (
                    <button
                      disabled={claiming}
                      onClick={async () => {
                        setClaiming(true);
                        try {
                          const updated = await claimTicket(ticket.id, session);
                          if (updated) onTicketUpdated(updated);
                        } catch { /* noop */ }
                        finally { setClaiming(false); }
                      }}
                      style={{
                        padding: "8px 16px", background: "#128C7E", border: "none",
                        borderRadius: 8,
                        color: "#fff", fontSize: 13, fontWeight: 700, cursor: "pointer",
                        opacity: claiming ? 0.6 : 1, flexShrink: 0,
                        minHeight: 38,
                        WebkitTapHighlightColor: "transparent",
                      }}
                    >
                      {claiming ? "…" : ticket.assignedToName ? "Re-assign" : "Claim"}
                    </button>
                  )}
                </div>
              );
            })()}

            {/* Error */}
            {actionError && (
              <div style={{
                background: "#fef2f2", border: "1px solid #fecaca",
                borderRadius: 10, padding: "10px 12px",
                fontSize: 13, color: "#dc2626", marginBottom: 12,
                lineHeight: 1.4, display: "flex", gap: 8, alignItems: "flex-start",
              }}>
                <span style={{ flexShrink: 0 }}>⚠️</span>
                <span>{actionError}</span>
              </div>
            )}

            {/* Primary actions */}
            {mainActions.map((action) => (
              <ActionBtn
                key={action.targetStatus}
                action={action}
                loading={actionLoading === action.targetStatus}
                onClick={() => handleActionClick(action)}
              />
            ))}

            {/* QR generate button */}
            {canGenerateQr && !showQrForm && (
              <button
                onClick={() => { setShowQrForm(true); setActiveTab("packets"); }}
                style={{
                  width: "100%", padding: "9px 12px", marginTop: 6,
                  border: "1px solid #e9edef", background: "#f9fafb",
                  fontSize: 12, color: "#667781", cursor: "pointer",
                  display: "flex", alignItems: "center", gap: 6,
                }}
              >
                <span>▦</span> Generate QR Labels
              </button>
            )}

            {/* Danger actions */}
            {dangerActions.length > 0 && (
              <div style={{ marginTop: 20, paddingTop: 16, borderTop: "1px solid #f0f2f5" }}>
                {dangerActions.map((action) => (
                  <button
                    key={action.targetStatus}
                    onClick={() => handleActionClick(action)}
                    disabled={!!actionLoading}
                    style={{
                      width: "100%", padding: "7px 12px",
                      border: "1px solid #fecaca", background: "#fff",
                      fontSize: 11, color: "#dc2626", cursor: "pointer",
                    }}
                  >
                    Close Ticket
                  </button>
                ))}
              </div>
            )}
          </div>
        )}

        {/* ─── DETAILS TAB ─── */}
        {activeTab === "details" && (
          <div style={{ padding: 14 }}>
            <Row label="Status" value={<span className={`badge badge-${ticket.status}`}>{ticket.status.replace(/_/g, " ")}</span>} />
            <Row label="Type" value={ticket.ticketType === "deployment" ? "Deployment" : "Transfer"} />
            <Row label="Priority" value={<span className={`badge badge-${ticket.priority}`}>{ticket.priority.toUpperCase()}</span>} />
            <Row label="Team" value={ticket.teamName} />
            <Row label="Factory" value={ticket.factoryName} />
            {ticket.sourceTeamName && <Row label="Source Team" value={ticket.sourceTeamName} />}
            {ticket.sourceFactoryName && <Row label="Source Factory" value={ticket.sourceFactoryName} />}
            <Row label="Deploy Date" value={fmtDate(ticket.deploymentDate)} mono />
            <Row label="Workers" value={ticket.workerCount} mono />
            <Row label="Devices" value={`${ticket.devicesRequested} requested`} mono />
            <Row label="SD Cards" value={`${ticket.sdCardsRequested} requested`} mono />

            {(ticket.items?.length ?? 0) > 0 && (
              <div style={{ marginTop: 12 }}>
                <div style={{ fontSize: 9, color: "#8696a0", fontFamily: "var(--font-mono)", textTransform: "uppercase", letterSpacing: "0.08em", marginBottom: 6 }}>
                  Item Breakdown
                </div>
                <table style={{ width: "100%", borderCollapse: "collapse", fontSize: 11 }}>
                  <thead>
                    <tr style={{ borderBottom: "1px solid #e9edef" }}>
                      <th style={{ textAlign: "left", padding: "4px 6px", fontSize: 9, color: "#8696a0", fontFamily: "var(--font-mono)", textTransform: "uppercase" }}>Item</th>
                      <th style={{ textAlign: "right", padding: "4px 6px", fontSize: 9, color: "#8696a0", fontFamily: "var(--font-mono)" }}>Req</th>
                      <th style={{ textAlign: "right", padding: "4px 6px", fontSize: 9, color: "#8696a0", fontFamily: "var(--font-mono)" }}>Appr</th>
                    </tr>
                  </thead>
                  <tbody>
                    {ticket.items.map((item) => (
                      <tr key={item.itemType} style={{ borderBottom: "1px solid #f0f2f5" }}>
                        <td style={{ padding: "5px 6px", color: "#111b21" }}>{item.itemType}</td>
                        <td style={{ padding: "5px 6px", textAlign: "right", fontFamily: "var(--font-mono)", color: "#667781" }}>{item.requestedQty}</td>
                        <td style={{ padding: "5px 6px", textAlign: "right", fontFamily: "var(--font-mono)", color: item.approvedQty ? "#111b21" : "#c8d0d8" }}>
                          {item.approvedQty || "—"}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}

            {/* Timeline events */}
            {(ticket.timeline?.length ?? 0) > 0 && (
              <div style={{ marginTop: 14 }}>
                <div style={{ fontSize: 9, color: "#8696a0", fontFamily: "var(--font-mono)", textTransform: "uppercase", letterSpacing: "0.08em", marginBottom: 8 }}>
                  Activity Log
                </div>
                <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
                  {[...(ticket.timeline ?? [])].reverse().map((ev) => (
                    <div key={ev.id} style={{
                      borderLeft: "2px solid #e9edef", paddingLeft: 8,
                      paddingBottom: 4,
                    }}>
                      <div style={{ fontSize: 11, fontWeight: 600, color: "#111b21" }}>{ev.label}</div>
                      <div style={{ fontSize: 10, color: "#8696a0" }}>
                        {ev.actor} · {new Date(ev.occurredAt).toLocaleString("en-GB")}
                      </div>
                      {ev.detail && <div style={{ fontSize: 10, color: "#667781", marginTop: 1 }}>{ev.detail}</div>}
                    </div>
                  ))}
                </div>
              </div>
            )}
          </div>
        )}

        {/* ─── MEMBERS TAB ─── */}
        {activeTab === "members" && (
          <MembersTab ticket={ticket} session={session} onTicketUpdated={onTicketUpdated} />
        )}

        {/* ─── PACKETS TAB ─── */}
        {activeTab === "packets" && (
          <div style={{ padding: 14 }}>
            {/* QR batch form */}
            {(showQrForm || canGenerateQr) && (
              <div style={{ marginBottom: 14 }}>
                {!showQrForm ? (
                  <button onClick={() => setShowQrForm(true)} style={{
                    width: "100%", padding: "8px 12px", border: "1px solid #e9edef",
                    background: "#f9fafb", fontSize: 12, color: "#667781", cursor: "pointer",
                  }}>
                    + Generate QR Labels
                  </button>
                ) : (
                  <div style={{ border: "1px solid #e9edef", padding: 12 }}>
                    <div style={{ fontSize: 11, fontWeight: 700, marginBottom: 10, color: "#111b21" }}>
                      Generate QR Labels
                    </div>
                    {qrError && <div style={{ background: "#fef2f2", border: "1px solid #fecaca", padding: "5px 8px", fontSize: 11, color: "#dc2626", marginBottom: 8 }}>{qrError}</div>}
                    <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
                      <NI label="Number of Labels" value={qrBatch.labelCount} onChange={(v) => setQrBatch((b) => ({ ...b, labelCount: v }))} />
                      <NI label="SD Cards per Label" value={qrBatch.shippedSdCardsCount} onChange={(v) => setQrBatch((b) => ({ ...b, shippedSdCardsCount: v }))} />
                      <NI label="Devices per Label" value={qrBatch.shippedDevicesCount} onChange={(v) => setQrBatch((b) => ({ ...b, shippedDevicesCount: v }))} />
                      <NI label="USB Hubs per Label" value={qrBatch.shippedUsbHubsCount} onChange={(v) => setQrBatch((b) => ({ ...b, shippedUsbHubsCount: v }))} />
                      <NI label="Cables per Label" value={qrBatch.shippedCablesCount} onChange={(v) => setQrBatch((b) => ({ ...b, shippedCablesCount: v }))} />
                      <div>
                        <div style={{ fontSize: 10, color: "#8696a0", textTransform: "uppercase", fontFamily: "var(--font-mono)", marginBottom: 3 }}>Note (optional)</div>
                        <input className="input" style={{ fontSize: 12 }} value={qrBatch.note} onChange={(e) => setQrBatch((b) => ({ ...b, note: e.target.value }))} placeholder="e.g. Batch 1 for Pune" />
                      </div>
                    </div>
                    <div style={{ display: "flex", gap: 6, marginTop: 10 }}>
                      <button onClick={() => void handleGenerateQr()} disabled={qrLoading} style={{
                        flex: 1, padding: "8px", background: "#128C7E", border: "none",
                        color: "#fff", fontSize: 12, cursor: "pointer", fontWeight: 600,
                      }}>
                        {qrLoading ? "Generating..." : `Generate ${qrBatch.labelCount} QR Label${qrBatch.labelCount > 1 ? "s" : ""}`}
                      </button>
                      <button onClick={() => setShowQrForm(false)} style={{
                        padding: "8px 12px", border: "1px solid #e9edef",
                        background: "#fff", fontSize: 12, cursor: "pointer", color: "#667781",
                      }}>Cancel</button>
                    </div>
                  </div>
                )}
              </div>
            )}

            {/* Package list */}
            {(ticket.packages?.length ?? 0) === 0 ? (
              <div style={{ textAlign: "center", padding: "24px 12px", color: "#8696a0", fontSize: 12 }}>
                <div style={{ fontSize: 24, marginBottom: 8 }}>📦</div>
                No packages yet.<br />
                <span style={{ fontSize: 11 }}>QR labels will appear after logistics creates them.</span>
              </div>
            ) : (
              <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
                {(ticket.packages ?? []).map((pkg) => (
                  <div key={pkg.packageCode} style={{ border: "1px solid #e9edef", padding: "10px 12px" }}>
                    <div style={{ display: "flex", alignItems: "center", gap: 6, marginBottom: 6 }}>
                      <span style={{ fontFamily: "var(--font-mono)", fontSize: 11, fontWeight: 700, color: "#111b21", flex: 1 }}>
                        {pkg.packageCode}
                      </span>
                      <span className={`badge badge-${pkg.direction === "outbound" ? "accepted" : "return_shipped"}`}>
                        {pkg.direction}
                      </span>
                    </div>
                    <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "3px 10px", fontSize: 11, color: "#667781", marginBottom: 8 }}>
                      <span>📦 {pkg.shippedDevicesCount} devices</span>
                      <span>💾 {pkg.shippedSdCardsCount} SD cards</span>
                      <span>🔌 {pkg.shippedUsbHubsCount} hubs</span>
                      <span>🔗 {pkg.shippedCablesCount} cables</span>
                    </div>
                    {pkg.qrToken && (
                      <div style={{ display: "flex", gap: 6 }}>
                        <a href={`/qr/${pkg.qrToken}`} target="_blank" rel="noreferrer" style={{
                          flex: 1, padding: "5px 8px", border: "1px solid #e9edef",
                          background: "#f9fafb", fontSize: 11, color: "#128C7E",
                          textAlign: "center", textDecoration: "none", fontWeight: 600,
                        }}>
                          Open QR Page ↗
                        </a>
                        <a href={qrSvgUrl(pkg.qrToken)} target="_blank" rel="noreferrer" style={{
                          padding: "5px 8px", border: "1px solid #e9edef",
                          background: "#f9fafb", fontSize: 11, color: "#667781",
                          textDecoration: "none",
                        }}>
                          SVG
                        </a>
                      </div>
                    )}
                  </div>
                ))}
              </div>
            )}
          </div>
        )}
      </div>

      {/* ─── Carrier / Shipment modal ─── */}
      {pendingAction && (
        <div style={{
          position: "fixed", inset: 0, background: "rgba(0,0,0,0.5)",
          zIndex: 100, display: "flex", alignItems: "center", justifyContent: "center", padding: 16,
        }} onClick={(e) => { if (e.target === e.currentTarget) setPendingAction(null); }}>
          <div style={{ background: "#fff", width: "100%", maxWidth: 400, padding: 0, overflow: "hidden" }}>
            <div style={{ background: "#075e54", padding: "14px 18px", color: "#fff" }}>
              <div style={{ fontSize: 14, fontWeight: 700 }}>{pendingAction.label}</div>
              <div style={{ fontSize: 11, marginTop: 2, opacity: 0.8 }}>Carrier info is optional — skip if not available</div>
            </div>
            <div style={{ padding: 18, display: "flex", flexDirection: "column", gap: 12 }}>
              {actionError && (
                <div style={{ background: "#fef2f2", border: "1px solid #fecaca", padding: "6px 10px", fontSize: 12, color: "#dc2626" }}>{actionError}</div>
              )}
              <div>
                <div style={{ fontSize: 10, color: "#8696a0", textTransform: "uppercase", fontFamily: "var(--font-mono)", marginBottom: 4 }}>
                  Carrier (optional)
                </div>
                <select
                  className="select"
                  value={carrier}
                  onChange={(e) => setCarrier(e.target.value)}
                  style={{ fontSize: 13, color: "#111b21" }}
                >
                  {CARRIERS.map((c) => (
                    <option key={c} value={c}>{c || "— Select carrier (optional)"}</option>
                  ))}
                </select>
              </div>
              <div>
                <div style={{ fontSize: 10, color: "#8696a0", textTransform: "uppercase", fontFamily: "var(--font-mono)", marginBottom: 4 }}>
                  Tracking / AWB Number (optional)
                </div>
                <input
                  className="input"
                  style={{ fontSize: 13 }}
                  placeholder="e.g. 12345678 or skip"
                  value={trackingNo}
                  onChange={(e) => setTrackingNo(e.target.value)}
                />
              </div>
              <div>
                <div style={{ fontSize: 10, color: "#8696a0", textTransform: "uppercase", fontFamily: "var(--font-mono)", marginBottom: 4 }}>
                  Note (optional)
                </div>
                <input
                  className="input"
                  style={{ fontSize: 13 }}
                  placeholder="Any shipment note..."
                  value={carrierNote}
                  onChange={(e) => setCarrierNote(e.target.value)}
                />
              </div>
            </div>
            <div style={{ display: "flex", gap: 0, borderTop: "1px solid #e9edef" }}>
              <button onClick={() => setPendingAction(null)} style={{
                flex: 1, padding: "12px", border: "none", background: "#f9fafb",
                fontSize: 13, color: "#667781", cursor: "pointer", borderRight: "1px solid #e9edef",
              }}>
                Cancel
              </button>
              <button
                onClick={() => void handleCarrierSubmit()}
                disabled={!!actionLoading}
                style={{
                  flex: 1, padding: "12px", border: "none", background: "#128C7E",
                  fontSize: 13, fontWeight: 700, color: "#fff", cursor: "pointer",
                }}
              >
                {actionLoading ? "Updating..." : "Confirm"}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ─── Close confirm ─── */}
      {showClose && (
        <div style={{
          position: "fixed", inset: 0, background: "rgba(0,0,0,0.5)",
          zIndex: 100, display: "flex", alignItems: "center", justifyContent: "center", padding: 16,
        }} onClick={(e) => { if (e.target === e.currentTarget) setShowClose(false); }}>
          <div style={{ background: "#fff", width: "100%", maxWidth: 360 }}>
            <div style={{ background: "#dc2626", padding: "14px 18px", color: "#fff" }}>
              <div style={{ fontSize: 14, fontWeight: 700 }}>Close Ticket</div>
              <div style={{ fontSize: 11, marginTop: 2, opacity: 0.85 }}>This action cannot be undone</div>
            </div>
            <div style={{ padding: 18, display: "flex", flexDirection: "column", gap: 12 }}>
              {actionError && (
                <div style={{ background: "#fef2f2", border: "1px solid #fecaca", padding: "6px 10px", fontSize: 12, color: "#dc2626" }}>{actionError}</div>
              )}
              <textarea
                className="textarea"
                style={{ fontSize: 13, minHeight: 72 }}
                placeholder="Closure reason (optional)"
                value={closeNote}
                onChange={(e) => setCloseNote(e.target.value)}
              />
            </div>
            <div style={{ display: "flex", borderTop: "1px solid #e9edef" }}>
              <button onClick={() => setShowClose(false)} style={{
                flex: 1, padding: "12px", border: "none", background: "#f9fafb",
                fontSize: 13, color: "#667781", cursor: "pointer", borderRight: "1px solid #e9edef",
              }}>
                Cancel
              </button>
              <button onClick={() => void handleClose()} disabled={!!actionLoading} style={{
                flex: 1, padding: "12px", border: "none", background: "#dc2626",
                fontSize: 13, fontWeight: 700, color: "#fff", cursor: "pointer",
              }}>
                {actionLoading === "closed" ? "Closing..." : "Close Ticket"}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

/* ─── Action button ────────────────────────────────────── */
function ActionBtn({ action, loading, onClick }: { action: Action; loading: boolean; onClick: () => void }) {
  const bg = action.variant === "accept" ? "#128C7E"
    : action.variant === "reject" ? "#dc2626"
    : action.variant === "primary" ? "#075e54"
    : "#f9fafb";
  const color = ["accept", "reject", "primary"].includes(action.variant) ? "#fff" : "#111b21";
  const border = ["accept", "reject", "primary"].includes(action.variant) ? "none" : "1px solid #e9edef";

  return (
    <button
      onClick={onClick}
      disabled={loading}
      style={{
        width: "100%",
        padding: "13px 16px",
        marginBottom: 8,
        background: loading ? "#aaa" : bg,
        border,
        borderRadius: 12,
        color,
        fontSize: 14,
        fontWeight: 700,
        cursor: loading ? "not-allowed" : "pointer",
        display: "flex",
        flexDirection: "column",
        alignItems: "flex-start",
        gap: 3,
        opacity: loading ? 0.8 : 1,
        transition: "opacity 0.15s, background 0.15s",
        WebkitTapHighlightColor: "transparent",
        minHeight: 52,
        justifyContent: "center",
      }}
    >
      <span>{loading ? "Working…" : action.label}</span>
      {action.sublabel && !loading && (
        <span style={{ fontSize: 11, fontWeight: 400, opacity: 0.72 }}>{action.sublabel}</span>
      )}
    </button>
  );
}

/* ─── Members Tab ──────────────────────────────────────────── */
const ROLE_COLORS: Record<string, string> = {
  admin: "#4B5563",
  logistics: "#1D4ED8",
  factory_operator: "#7E22CE",
  ingestion: "#B45309",
};

function roleLabelShort(role: string) {
  return role === "factory_operator" ? "Factory" : role.charAt(0).toUpperCase() + role.slice(1);
}

function memberInitial(name: string) {
  return name ? name[0].toUpperCase() : "?";
}

function MembersTab({ ticket, session, onTicketUpdated }: {
  ticket: TicketRecord;
  session: AuthSession;
  onTicketUpdated: (t: TicketRecord) => void;
}) {
  const [inviteEmail, setInviteEmail] = useState("");
  const [lookupResult, setLookupResult] = useState<import("@/lib/operations-types").UserProfile | null | "not_found">(null);
  const [looking, setLooking] = useState(false);
  const [adding, setAdding] = useState(false);
  const [removing, setRemoving] = useState<string | null>(null);
  const [err, setErr] = useState("");

  const canManage = ["admin", "logistics"].includes(session.user.role);
  const members: TicketMember[] = ticket.members ?? [];

  async function handleLookup() {
    if (!inviteEmail.trim()) return;
    setLooking(true); setErr(""); setLookupResult(null);
    const user = await lookupUserByEmail(inviteEmail.trim(), session);
    setLooking(false);
    if (user) setLookupResult(user);
    else setLookupResult("not_found");
  }

  async function handleAdd(email: string) {
    setAdding(true); setErr("");
    try {
      const updated = await addTicketMember(ticket.id, email, session);
      if (updated) { onTicketUpdated(updated); setInviteEmail(""); setLookupResult(null); }
    } catch (e) {
      setErr(e instanceof Error ? e.message : "Failed to add member.");
    } finally { setAdding(false); }
  }

  async function handleRemove(email: string) {
    setRemoving(email); setErr("");
    try {
      const updated = await removeTicketMember(ticket.id, email, session);
      if (updated) onTicketUpdated(updated);
    } catch (e) {
      setErr(e instanceof Error ? e.message : "Failed to remove member.");
    } finally { setRemoving(null); }
  }

  return (
    <div style={{ padding: 14 }}>
      {canManage && (
        <div style={{ marginBottom: 16 }}>
          <div style={{ fontSize: 9, color: "#8696a0", textTransform: "uppercase", fontFamily: "var(--font-mono)", letterSpacing: "0.08em", marginBottom: 6 }}>
            Add Member by Email
          </div>
          <div style={{ display: "flex", gap: 6 }}>
            <input
              className="input"
              style={{ flex: 1, fontSize: 12 }}
              placeholder="someone@company.com"
              value={inviteEmail}
              onChange={(e) => { setInviteEmail(e.target.value); setLookupResult(null); }}
              onKeyDown={(e) => { if (e.key === "Enter") { e.preventDefault(); void handleLookup(); } }}
            />
            <button
              onClick={() => void handleLookup()}
              disabled={looking || !inviteEmail.trim()}
              style={{
                padding: "0 12px", background: "#128C7E", border: "none",
                color: "#fff", fontSize: 12, fontWeight: 600, cursor: "pointer",
                opacity: looking || !inviteEmail.trim() ? 0.6 : 1,
              }}
            >
              {looking ? "…" : "Find"}
            </button>
          </div>
          {err && <div style={{ marginTop: 6, fontSize: 11, color: "#dc2626" }}>{err}</div>}
          {lookupResult === "not_found" && (
            <div style={{ marginTop: 8, padding: "8px 10px", background: "#fef2f2", border: "1px solid #fecaca", fontSize: 12, color: "#dc2626" }}>
              No registered user found with that email.
            </div>
          )}
          {lookupResult && lookupResult !== "not_found" && (
            <div style={{ marginTop: 8, padding: "10px 12px", background: "#f0fdf4", border: "1px solid #bbf7d0", display: "flex", alignItems: "center", gap: 10 }}>
              <div style={{
                width: 32, height: 32, borderRadius: "50%", flexShrink: 0,
                background: ROLE_COLORS[lookupResult.role] ?? "#4B5563",
                display: "flex", alignItems: "center", justifyContent: "center",
                fontSize: 13, fontWeight: 700, color: "#fff",
              }}>
                {memberInitial(lookupResult.displayName)}
              </div>
              <div style={{ flex: 1, minWidth: 0 }}>
                <div style={{ fontSize: 12, fontWeight: 700, color: "#111b21" }}>{lookupResult.displayName}</div>
                <div style={{ fontSize: 10, color: "#667781" }}>{lookupResult.email} · {roleLabelShort(lookupResult.role)}</div>
              </div>
              <button
                onClick={() => void handleAdd(lookupResult.email)}
                disabled={adding || members.some((m) => m.email.toLowerCase() === lookupResult.email.toLowerCase())}
                style={{
                  padding: "5px 12px", background: "#128C7E", border: "none",
                  color: "#fff", fontSize: 11, fontWeight: 700, cursor: "pointer",
                  opacity: adding ? 0.6 : 1, flexShrink: 0,
                }}
              >
                {adding ? "Adding…" : members.some((m) => m.email.toLowerCase() === lookupResult.email.toLowerCase()) ? "Added ✓" : "Add to Group"}
              </button>
            </div>
          )}
        </div>
      )}

      <div style={{ fontSize: 9, color: "#8696a0", textTransform: "uppercase", fontFamily: "var(--font-mono)", letterSpacing: "0.08em", marginBottom: 8 }}>
        {members.length === 0 ? "No members yet" : `${members.length} Member${members.length !== 1 ? "s" : ""}`}
      </div>

      {members.length === 0 ? (
        <div style={{ textAlign: "center", padding: "20px 0", color: "#8696a0", fontSize: 12 }}>
          <div style={{ fontSize: 28, marginBottom: 6 }}>👥</div>
          {canManage ? "Invite people by entering their email above." : "No members have been added yet."}
        </div>
      ) : (
        <div style={{ display: "flex", flexDirection: "column", gap: 6 }}>
          {members.map((m) => (
            <div key={m.email} style={{ display: "flex", alignItems: "center", gap: 10, padding: "8px 10px", border: "1px solid #e9edef", background: "#fff" }}>
              <div style={{
                width: 34, height: 34, borderRadius: "50%", flexShrink: 0,
                background: ROLE_COLORS[m.role] ?? "#4B5563",
                display: "flex", alignItems: "center", justifyContent: "center",
                fontSize: 13, fontWeight: 700, color: "#fff",
              }}>
                {memberInitial(m.displayName)}
              </div>
              <div style={{ flex: 1, minWidth: 0 }}>
                <div style={{ fontSize: 12, fontWeight: 600, color: "#111b21", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{m.displayName}</div>
                <div style={{ fontSize: 10, color: "#667781", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{m.email}</div>
                <span style={{
                  fontSize: 9, padding: "1px 6px", display: "inline-block", marginTop: 2,
                  background: `${ROLE_COLORS[m.role] ?? "#4B5563"}22`,
                  color: ROLE_COLORS[m.role] ?? "#4B5563",
                  borderRadius: 10, fontWeight: 600,
                }}>
                  {roleLabelShort(m.role)}
                </span>
              </div>
              {canManage && (
                <button
                  onClick={() => void handleRemove(m.email)}
                  disabled={removing === m.email}
                  style={{ background: "none", border: "none", color: "#8696a0", cursor: "pointer", fontSize: 18, lineHeight: 1, flexShrink: 0, opacity: removing === m.email ? 0.4 : 1 }}
                  title="Remove member"
                >×</button>
              )}
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

/* ─── Helpers ──────────────────────────────────────────── */
function Row({ label, value, mono }: { label: string; value: React.ReactNode; mono?: boolean }) {
  return (
    <div style={{ display: "flex", gap: 8, padding: "5px 0", borderBottom: "1px solid #f0f2f5", alignItems: "flex-start" }}>
      <span style={{ fontSize: 10, color: "#8696a0", fontFamily: "var(--font-mono)", textTransform: "uppercase", letterSpacing: "0.04em", minWidth: 76, flexShrink: 0, paddingTop: 1 }}>
        {label}
      </span>
      <span style={{ fontSize: 12, color: "#111b21", fontFamily: mono ? "var(--font-mono)" : undefined, flex: 1 }}>
        {value}
      </span>
    </div>
  );
}

function NI({ label, value, onChange }: { label: string; value: number; onChange: (v: number) => void }) {
  return (
    <div>
      <div style={{ fontSize: 10, color: "#8696a0", textTransform: "uppercase", fontFamily: "var(--font-mono)", marginBottom: 3 }}>{label}</div>
      <input type="number" className="input" style={{ fontSize: 13, fontFamily: "var(--font-mono)" }} value={value} min={0}
        onChange={(e) => onChange(parseInt(e.target.value, 10) || 0)} />
    </div>
  );
}
