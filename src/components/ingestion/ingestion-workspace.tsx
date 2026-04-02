"use client";

import { useState } from "react";
import { saveIngestionReconciliation, updateTicketStatus } from "@/lib/backend";
import type {
  AuthSession,
  DashboardSnapshot,
  IngestionQueueItem,
  IngestionReconciliationInput,
  TicketRecord,
  TicketStatus,
} from "@/lib/operations-types";

type Props = {
  snapshot: DashboardSnapshot;
  session: AuthSession;
};

function statusLabel(s: TicketStatus) {
  const map: Record<string, string> = {
    transferred_to_ingestion: "Transferred",
    ingestion_processing: "Processing",
    ingestion_completed: "Completed",
  };
  return map[s] ?? s.replace(/_/g, " ");
}

function formatDate(s: string) {
  try { return new Date(s).toLocaleDateString("en-GB", { day: "2-digit", month: "short", year: "numeric" }); } catch { return s; }
}

export function IngestionWorkspace({ snapshot, session }: Props) {
  const role = session.user.role;
  const queue = snapshot.ingestionQueue ?? [];
  const tickets = snapshot.tickets ?? [];

  const [selectedItem, setSelectedItem] = useState<IngestionQueueItem | null>(null);
  const [filter, setFilter] = useState<"" | "transferred_to_ingestion" | "ingestion_processing" | "ingestion_completed">("");
  const [actionLoading, setActionLoading] = useState(false);
  const [actionError, setActionError] = useState("");
  const [showRecon, setShowRecon] = useState(false);
  const [recon, setRecon] = useState<{
    station: string;
    expectedSdCards: number;
    actualSdCardsReceived: number;
    processedSdCards: number;
    faultySdCards: number;
    note: string;
  }>({
    station: "",
    expectedSdCards: 0,
    actualSdCardsReceived: 0,
    processedSdCards: 0,
    faultySdCards: 0,
    note: "",
  });

  const selectedTicket: TicketRecord | undefined = selectedItem
    ? tickets.find((t) => t.packages?.some((p) => p.packageCode === selectedItem.packageCode))
    : undefined;

  const missingSdCards = Math.max(0, recon.actualSdCardsReceived - recon.processedSdCards - recon.faultySdCards);

  const filtered = queue.filter((q) => !filter || q.status === filter);

  async function handleStatusChange(item: IngestionQueueItem, status: TicketStatus) {
    const ticket = tickets.find((t) => t.packages?.some((p) => p.packageCode === item.packageCode));
    if (!ticket) { setActionError("Ticket not found."); return; }
    setActionLoading(true);
    setActionError("");
    try {
      await updateTicketStatus(ticket.id, { status }, session);
      setSelectedItem((prev) => prev ? { ...prev, status } : prev);
      // Refresh in real app — for now update locally
    } catch (err) {
      setActionError(err instanceof Error ? err.message : "Action failed.");
    } finally {
      setActionLoading(false);
    }
  }

  async function handleReconcile() {
    if (!selectedTicket) { setActionError("Ticket not found."); return; }
    setActionLoading(true);
    setActionError("");
    try {
      const payload: IngestionReconciliationInput = {
        station: recon.station || "Ingestion Room",
        expectedSdCards: recon.expectedSdCards,
        actualSdCardsReceived: recon.actualSdCardsReceived,
        processedSdCards: recon.processedSdCards,
        missingSdCards,
        faultySdCards: recon.faultySdCards,
        note: recon.note,
        markCompleted: true,
        startedAt: new Date().toISOString(),
      };
      await saveIngestionReconciliation(selectedTicket.id, payload, session);
      setShowRecon(false);
      setSelectedItem((prev) => prev ? { ...prev, status: "ingestion_completed" } : prev);
    } catch (err) {
      setActionError(err instanceof Error ? err.message : "Reconciliation failed.");
    } finally {
      setActionLoading(false);
    }
  }

  return (
    <div style={{ height: "100%", display: "flex", flexDirection: "column", overflow: "hidden" }}>
      {/* Header */}
      <div className="workspace-header">
        <div style={{ fontSize: 13, fontWeight: 700, color: "var(--text-primary)" }}>Ingestion Queue</div>
        <div style={{ marginLeft: "auto", display: "flex", gap: 6 }}>
          {(["", "transferred_to_ingestion", "ingestion_processing", "ingestion_completed"] as const).map((f) => (
            <button
              key={f}
              onClick={() => setFilter(f)}
              style={{
                padding: "2px 8px", fontSize: 10, fontFamily: "var(--font-mono)",
                border: "1px solid", textTransform: "uppercase", letterSpacing: "0.04em",
                borderColor: filter === f ? "var(--text-primary)" : "var(--border)",
                background: filter === f ? "var(--text-primary)" : "var(--bg)",
                color: filter === f ? "var(--action-text)" : "var(--text-secondary)",
                cursor: "pointer",
              }}
            >
              {f === "" ? "All" : f === "transferred_to_ingestion" ? "Transferred" : f === "ingestion_processing" ? "Processing" : "Done"}
            </button>
          ))}
        </div>
      </div>

      <div style={{ flex: 1, display: "flex", overflow: "hidden" }} className="ingestion-split">
        {/* Queue list */}
        <div style={{ width: 340, minWidth: 340, borderRight: "1px solid var(--border)", overflowY: "auto", background: "var(--bg)" }} className="ingestion-queue-pane">
          {filtered.length === 0 ? (
            <div className="empty-state" style={{ padding: "40px 16px" }}>
              <div className="empty-state-icon">⊞</div>
              <div className="empty-state-title">No items in queue</div>
              <div className="empty-state-desc">Packets transferred from logistics will appear here.</div>
            </div>
          ) : (
            filtered.map((item) => (
              <div
                key={item.id}
                onClick={() => { setSelectedItem(item); setShowRecon(false); setActionError(""); }}
                style={{
                  padding: "11px 14px", borderBottom: "1px solid var(--border)", cursor: "pointer",
                  background: selectedItem?.id === item.id ? "var(--bg-muted)" : "var(--bg)",
                  borderLeft: selectedItem?.id === item.id ? "2px solid var(--action)" : "2px solid transparent",
                }}
              >
                <div style={{ display: "flex", alignItems: "center", gap: 6, marginBottom: 4 }}>
                  <span className="mono" style={{ fontSize: 11, fontWeight: 700, flex: 1, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
                    {item.packageCode}
                  </span>
                  <span className={`badge badge-${item.status}`}>{statusLabel(item.status)}</span>
                </div>
                <div style={{ fontSize: 12, fontWeight: 500, color: "var(--text-primary)" }}>{item.teamName}</div>
                <div style={{ fontSize: 11, color: "var(--text-secondary)" }}>{item.factoryName}</div>
                <div style={{ display: "flex", gap: 12, marginTop: 4, fontSize: 10, color: "var(--text-muted)", fontFamily: "var(--font-mono)" }}>
                  <span>Deploy: {formatDate(item.deploymentDate)}</span>
                  <span>SD Cards: <strong style={{ color: "var(--text-primary)" }}>{item.expectedSdCards}</strong></span>
                </div>
              </div>
            ))
          )}
        </div>

        {/* Detail panel */}
        <div style={{ flex: 1, overflowY: "auto", background: "var(--bg-subtle)" }}>
          {!selectedItem ? (
            <div className="empty-state" style={{ height: "100%" }}>
              <div className="empty-state-icon">⊞</div>
              <div className="empty-state-title">Select a packet</div>
              <div className="empty-state-desc">Click a packet from the queue to view details and actions.</div>
            </div>
          ) : (
            <div style={{ padding: 20, display: "flex", flexDirection: "column", gap: 16 }}>
              {/* Packet info */}
              <div className="panel">
                <div className="panel-header">
                  <span className="panel-title">Packet Identity</span>
                  <span className={`badge badge-${selectedItem.status}`}>{statusLabel(selectedItem.status)}</span>
                </div>
                <div style={{ padding: "12px 14px", display: "grid", gridTemplateColumns: "1fr 1fr", gap: "8px 16px" }}>
                  <InfoRow label="Team" value={selectedItem.teamName} />
                  <InfoRow label="Factory" value={selectedItem.factoryName} />
                  <InfoRow label="Deploy Date" value={formatDate(selectedItem.deploymentDate)} mono />
                  <InfoRow label="Expected SD Cards" value={selectedItem.expectedSdCards} mono />
                  <InfoRow label="Packet Code" value={selectedItem.packageCode} mono />
                </div>
              </div>

              {/* Actions */}
              {(role === "ingestion" || role === "admin" || role === "logistics") && (
                <div className="panel">
                  <div className="panel-header">
                    <span className="panel-title">Actions</span>
                  </div>
                  <div style={{ padding: "12px 14px", display: "flex", flexDirection: "column", gap: 8 }}>
                    {actionError && <div className="alert alert-error" style={{ fontSize: 11, padding: "5px 8px" }}>{actionError}</div>}

                    {selectedItem.status === "transferred_to_ingestion" && (
                      <button
                        onClick={() => void handleStatusChange(selectedItem, "ingestion_processing")}
                        className="btn btn-primary"
                        disabled={actionLoading}
                        style={{ fontSize: 12 }}
                      >
                        {actionLoading ? "Working..." : "Start Processing"}
                      </button>
                    )}

                    {selectedItem.status === "ingestion_processing" && !showRecon && (
                      <button
                        onClick={() => {
                          setShowRecon(true);
                          setRecon((r) => ({ ...r, expectedSdCards: selectedItem.expectedSdCards }));
                        }}
                        className="btn btn-primary"
                        style={{ fontSize: 12 }}
                      >
                        Submit Reconciliation
                      </button>
                    )}

                    {selectedItem.status === "ingestion_completed" && (
                      <div className="alert alert-success" style={{ fontSize: 12 }}>
                        ✓ Ingestion completed for this packet.
                      </div>
                    )}
                  </div>
                </div>
              )}

              {/* Reconciliation form */}
              {showRecon && selectedItem.status === "ingestion_processing" && (
                <div className="panel">
                  <div className="panel-header">
                    <span className="panel-title">Ingestion Reconciliation</span>
                  </div>
                  <div style={{ padding: "14px" }}>
                    <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 10, marginBottom: 10 }}>
                      <div className="form-group">
                        <label className="form-label">Station</label>
                        <input className="input" style={{ fontSize: 12 }} placeholder="e.g. Room B-3" value={recon.station} onChange={(e) => setRecon((r) => ({ ...r, station: e.target.value }))} />
                      </div>
                      <div className="form-group">
                        <label className="form-label">Expected SD Cards</label>
                        <input type="number" className="input" style={{ fontFamily: "var(--font-mono)" }} min={0} value={recon.expectedSdCards} onChange={(e) => setRecon((r) => ({ ...r, expectedSdCards: parseInt(e.target.value, 10) || 0 }))} />
                      </div>
                      <div className="form-group">
                        <label className="form-label">Actual SD Cards Received</label>
                        <input type="number" className="input" style={{ fontFamily: "var(--font-mono)" }} min={0} value={recon.actualSdCardsReceived} onChange={(e) => setRecon((r) => ({ ...r, actualSdCardsReceived: parseInt(e.target.value, 10) || 0 }))} autoFocus />
                      </div>
                      <div className="form-group">
                        <label className="form-label">Processed (Working)</label>
                        <input type="number" className="input" style={{ fontFamily: "var(--font-mono)" }} min={0} value={recon.processedSdCards} onChange={(e) => setRecon((r) => ({ ...r, processedSdCards: parseInt(e.target.value, 10) || 0 }))} />
                      </div>
                      <div className="form-group">
                        <label className="form-label">Faulty / Red</label>
                        <input type="number" className="input" style={{ fontFamily: "var(--font-mono)" }} min={0} value={recon.faultySdCards} onChange={(e) => setRecon((r) => ({ ...r, faultySdCards: parseInt(e.target.value, 10) || 0 }))} />
                      </div>
                      <div className="form-group">
                        <label className="form-label">Missing (Auto)</label>
                        <div className="input" style={{
                          display: "flex", alignItems: "center", fontFamily: "var(--font-mono)",
                          background: "var(--bg-muted)", color: missingSdCards > 0 ? "var(--error)" : "var(--text-muted)",
                          fontSize: 14, fontWeight: 700,
                        }}>
                          {missingSdCards}
                        </div>
                        <div style={{ fontSize: 10, color: "var(--text-muted)" }}>Actual − (Processed + Faulty)</div>
                      </div>
                    </div>

                    <div className="form-group" style={{ marginBottom: 10 }}>
                      <label className="form-label">Notes</label>
                      <textarea className="textarea" style={{ fontSize: 12, minHeight: 56 }} placeholder="Observations, issues, or context..." value={recon.note} onChange={(e) => setRecon((r) => ({ ...r, note: e.target.value }))} />
                    </div>

                    {/* Summary */}
                    <div style={{ background: "var(--bg-muted)", padding: "8px 12px", border: "1px solid var(--border)", marginBottom: 10, fontSize: 11 }}>
                      <div style={{ display: "flex", justifyContent: "space-between" }}>
                        <span style={{ color: "var(--text-muted)" }}>Expected</span>
                        <span className="mono">{recon.expectedSdCards}</span>
                      </div>
                      <div style={{ display: "flex", justifyContent: "space-between" }}>
                        <span style={{ color: "var(--text-muted)" }}>Received</span>
                        <span className="mono">{recon.actualSdCardsReceived}</span>
                      </div>
                      <div style={{ display: "flex", justifyContent: "space-between" }}>
                        <span style={{ color: "var(--text-muted)" }}>Processed</span>
                        <span className="mono">{recon.processedSdCards}</span>
                      </div>
                      <div style={{ display: "flex", justifyContent: "space-between" }}>
                        <span style={{ color: "var(--text-muted)" }}>Faulty</span>
                        <span className="mono" style={{ color: recon.faultySdCards > 0 ? "var(--warning)" : undefined }}>{recon.faultySdCards}</span>
                      </div>
                      <div style={{ height: 1, background: "var(--border)", margin: "4px 0" }} />
                      <div style={{ display: "flex", justifyContent: "space-between", fontWeight: 700 }}>
                        <span>Missing</span>
                        <span className="mono" style={{ color: missingSdCards > 0 ? "var(--error)" : "var(--success)" }}>
                          {missingSdCards > 0 ? `-${missingSdCards}` : "0"}
                        </span>
                      </div>
                    </div>

                    {actionError && <div className="alert alert-error" style={{ fontSize: 11, padding: "5px 8px", marginBottom: 8 }}>{actionError}</div>}

                    <div style={{ display: "flex", gap: 8 }}>
                      <button onClick={() => void handleReconcile()} className="btn btn-primary" disabled={actionLoading} style={{ flex: 1, fontSize: 12 }}>
                        {actionLoading ? "Submitting..." : "Complete Ingestion"}
                      </button>
                      <button onClick={() => setShowRecon(false)} className="btn btn-secondary" style={{ fontSize: 12 }}>Cancel</button>
                    </div>
                  </div>
                </div>
              )}

              {/* Ingestion report (if completed) */}
              {selectedTicket?.ingestionReport && selectedItem.status === "ingestion_completed" && (
                <div className="panel">
                  <div className="panel-header">
                    <span className="panel-title">Reconciliation Report</span>
                  </div>
                  <div style={{ padding: "12px 14px", display: "grid", gridTemplateColumns: "1fr 1fr", gap: "6px 16px" }}>
                    <InfoRow label="Station" value={selectedTicket.ingestionReport.station} />
                    <InfoRow label="Expected" value={selectedTicket.ingestionReport.expectedSdCards} mono />
                    <InfoRow label="Received" value={selectedTicket.ingestionReport.actualSdCardsReceived} mono />
                    <InfoRow label="Processed" value={selectedTicket.ingestionReport.processedSdCards} mono />
                    <InfoRow label="Faulty" value={selectedTicket.ingestionReport.faultySdCards} mono />
                    <InfoRow
                      label="Missing"
                      value={<span style={{ color: selectedTicket.ingestionReport.missingSdCards > 0 ? "var(--error)" : undefined }}>
                        {selectedTicket.ingestionReport.missingSdCards}
                      </span>}
                    />
                    {selectedTicket.ingestionReport.note && (
                      <div style={{ gridColumn: "1 / -1" }}>
                        <InfoRow label="Note" value={selectedTicket.ingestionReport.note} />
                      </div>
                    )}
                  </div>
                </div>
              )}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

function InfoRow({ label, value, mono }: { label: string; value: React.ReactNode; mono?: boolean }) {
  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 2 }}>
      <span style={{ fontSize: 9, color: "var(--text-muted)", fontFamily: "var(--font-mono)", textTransform: "uppercase", letterSpacing: "0.06em" }}>{label}</span>
      <span style={{ fontSize: 13, color: "var(--text-primary)", fontFamily: mono ? "var(--font-mono)" : undefined, fontWeight: 500 }}>{value}</span>
    </div>
  );
}
