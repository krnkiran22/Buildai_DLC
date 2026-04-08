"use client";

import { useState, useCallback } from "react";
import { createIngestionRun, updateTicketStatus } from "@/lib/backend";
import type {
  AuthSession,
  DashboardSnapshot,
  IngestionRun,
  IngestionRunCreateInput,
  TicketRecord,
  TicketStatus,
} from "@/lib/operations-types";

type Props = {
  snapshot: DashboardSnapshot;
  session: AuthSession;
  onTicketUpdate?: (ticket: TicketRecord) => void;
};

// Batch form state
type BatchForm = {
  qrCode: string;
  packageLabel: string;
  totalInPacket: number;
  goodSdCards: number;
  badSdCards: number;
  missingSdCards: number;
  notes: string;
  markCompleted: boolean;
};

const EMPTY_FORM: BatchForm = {
  qrCode: "",
  packageLabel: "",
  totalInPacket: 0,
  goodSdCards: 0,
  badSdCards: 0,
  missingSdCards: 0,
  notes: "",
  markCompleted: false,
};

function statusLabel(s: TicketStatus) {
  const map: Record<string, string> = {
    transferred_to_ingestion: "Pending",
    ingestion_processing: "Processing",
    ingestion_completed: "Done",
    closed: "Closed",
  };
  return map[s] ?? s.replace(/_/g, " ");
}

function statusDot(s: TicketStatus) {
  const map: Record<string, string> = {
    transferred_to_ingestion: "var(--warning)",
    ingestion_processing: "var(--info)",
    ingestion_completed: "var(--success)",
    closed: "var(--text-muted)",
  };
  return map[s] ?? "var(--text-muted)";
}

function fmtDate(s: string) {
  try {
    return new Date(s).toLocaleDateString("en-GB", { day: "2-digit", month: "short", year: "numeric" });
  } catch { return s; }
}

function fmtTime(s: string) {
  try {
    return new Date(s).toLocaleString("en-GB", {
      day: "2-digit", month: "short", hour: "2-digit", minute: "2-digit",
    });
  } catch { return s; }
}

function totalProcessed(runs: IngestionRun[]) {
  return runs.reduce((sum, r) => sum + r.goodSdCards, 0);
}

function totalBadCards(runs: IngestionRun[]) {
  return runs.reduce((sum, r) => sum + r.badSdCards, 0);
}

function totalMissingCards(runs: IngestionRun[]) {
  return runs.reduce((sum, r) => sum + r.missingSdCards, 0);
}

function totalExpected(runs: IngestionRun[]) {
  return runs.reduce((sum, r) => sum + r.totalInPacket, 0);
}

export function IngestionWorkspace({ snapshot, session, onTicketUpdate }: Props) {
  const role = session.user.role;
  // Backend already filters tickets for ingestion role to only show transferred_to_ingestion+
  const tickets: TicketRecord[] = (snapshot.tickets ?? []).filter(
    (t) => ["transferred_to_ingestion", "ingestion_processing", "ingestion_completed", "closed"].includes(t.status),
  );

  const [selectedTicketId, setSelectedTicketId] = useState<string | null>(() => tickets[0]?.id ?? null);
  const [filterStatus, setFilterStatus] = useState<"" | TicketStatus>("");
  const [showBatchForm, setShowBatchForm] = useState(false);
  const [form, setForm] = useState<BatchForm>(EMPTY_FORM);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [localTickets, setLocalTickets] = useState<Record<string, TicketRecord>>({});

  const selectedTicket = (() => {
    const override = selectedTicketId ? localTickets[selectedTicketId] : null;
    if (override) return override;
    return tickets.find((t) => t.id === selectedTicketId) ?? null;
  })();

  const displayTickets = tickets.filter((t) => !filterStatus || t.status === filterStatus);

  // Auto-fill missing from total - good - bad
  const autoMissing = Math.max(0, form.totalInPacket - form.goodSdCards - form.badSdCards);

  const canAddBatch = role === "ingestion" || role === "admin";
  const canComplete = (role === "ingestion" || role === "admin") && selectedTicket?.status === "ingestion_processing";

  const handleQrScan = useCallback((raw: string) => {
    // If the QR value contains a URL with a token, extract the token part
    const trimmed = raw.trim();
    setForm((f) => ({
      ...f,
      qrCode: trimmed,
      packageLabel: f.packageLabel || trimmed.split("/").pop() || trimmed,
    }));
  }, []);

  async function submitBatch(markCompleted: boolean) {
    if (!selectedTicket) return;
    if (form.totalInPacket < 1) { setError("Total in packet must be at least 1."); return; }
    if (form.goodSdCards + form.badSdCards + autoMissing > form.totalInPacket) {
      setError("Good + bad + missing cannot exceed total in packet."); return;
    }

    setLoading(true);
    setError("");
    try {
      const payload: IngestionRunCreateInput = {
        qrCode: form.qrCode || null,
        packageLabel: form.packageLabel || null,
        totalInPacket: form.totalInPacket,
        goodSdCards: form.goodSdCards,
        badSdCards: form.badSdCards,
        missingSdCards: autoMissing,
        notes: form.notes,
        markCompleted,
      };
      const updated = await createIngestionRun(selectedTicket.id, payload, session);
      setLocalTickets((prev) => ({ ...prev, [updated.id]: updated }));
      onTicketUpdate?.(updated);
      setForm(EMPTY_FORM);
      setShowBatchForm(false);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to save batch.");
    } finally {
      setLoading(false);
    }
  }

  async function handleMarkTransferred() {
    if (!selectedTicket) return;
    setLoading(true);
    setError("");
    try {
      await updateTicketStatus(selectedTicket.id, { status: "ingestion_processing" }, session);
      setLocalTickets((prev) => ({ ...prev, [selectedTicket.id]: { ...selectedTicket, status: "ingestion_processing" } }));
    } catch (err) {
      setError(err instanceof Error ? err.message : "Action failed.");
    } finally {
      setLoading(false);
    }
  }

  const runs: IngestionRun[] = selectedTicket?.ingestionRuns ?? [];
  const sdCardsTotal = selectedTicket?.sdCardsRequested ?? 0;
  const processed = totalProcessed(runs);
  const bad = totalBadCards(runs);
  const missing = totalMissingCards(runs);
  const expected = totalExpected(runs);
  const progress = sdCardsTotal > 0 ? Math.min(100, Math.round((processed / sdCardsTotal) * 100)) : 0;
  const remaining = Math.max(0, sdCardsTotal - processed);

  return (
    <div style={{ height: "100%", display: "flex", flexDirection: "column", overflow: "hidden" }}>
      {/* Header */}
      <div className="workspace-header">
        <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
          <span style={{ fontSize: 13, fontWeight: 700 }}>Ingestion</span>
          <span className="badge" style={{ background: "var(--bg-muted)", color: "var(--text-muted)", fontSize: 9 }}>
            {displayTickets.length} ticket{displayTickets.length !== 1 ? "s" : ""}
          </span>
        </div>
        <div style={{ marginLeft: "auto", display: "flex", gap: 4 }}>
          {(["", "transferred_to_ingestion", "ingestion_processing", "ingestion_completed"] as const).map((f) => (
            <button
              key={f}
              onClick={() => setFilterStatus(f)}
              style={{
                padding: "3px 9px", fontSize: 10, fontFamily: "var(--font-mono)",
                border: "1px solid", textTransform: "uppercase", letterSpacing: "0.04em",
                borderColor: filterStatus === f ? "var(--text-primary)" : "var(--border)",
                background: filterStatus === f ? "var(--text-primary)" : "transparent",
                color: filterStatus === f ? "var(--action-text)" : "var(--text-secondary)",
                cursor: "pointer", borderRadius: 3,
              }}
            >
              {f === "" ? "All" : f === "transferred_to_ingestion" ? "Pending" : f === "ingestion_processing" ? "Processing" : "Done"}
            </button>
          ))}
        </div>
      </div>

      <div style={{ flex: 1, display: "flex", overflow: "hidden" }}>
        {/* Ticket list pane */}
        <div className="ingestion-queue-pane" style={{
          width: 320, minWidth: 260, maxWidth: 360, borderRight: "1px solid var(--border)",
          overflowY: "auto", background: "var(--bg)",
        }}>
          {displayTickets.length === 0 ? (
            <div className="empty-state" style={{ padding: "40px 16px" }}>
              <div className="empty-state-icon">📦</div>
              <div className="empty-state-title">No tickets yet</div>
              <div className="empty-state-desc">Tickets transferred from Logistics will appear here.</div>
            </div>
          ) : (
            displayTickets.map((t) => {
              const tRuns: IngestionRun[] = (localTickets[t.id] ?? t).ingestionRuns ?? [];
              const tProcessed = totalProcessed(tRuns);
              const tTotal = t.sdCardsRequested;
              const tPct = tTotal > 0 ? Math.min(100, Math.round((tProcessed / tTotal) * 100)) : 0;
              const isActive = selectedTicketId === t.id;
              return (
                <div
                  key={t.id}
                  onClick={() => { setSelectedTicketId(t.id); setShowBatchForm(false); setError(""); }}
                  style={{
                    padding: "11px 13px", borderBottom: "1px solid var(--border)", cursor: "pointer",
                    background: isActive ? "var(--bg-muted)" : "var(--bg)",
                    borderLeft: isActive ? "2px solid var(--action)" : "2px solid transparent",
                    transition: "background 0.15s",
                  }}
                >
                  <div style={{ display: "flex", alignItems: "center", gap: 6, marginBottom: 3 }}>
                    <span style={{
                      width: 7, height: 7, borderRadius: "50%", flexShrink: 0,
                      background: statusDot(t.status),
                    }} />
                    <span style={{ fontSize: 11, fontWeight: 600, flex: 1, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
                      {t.teamName}
                    </span>
                    <span style={{ fontSize: 9, fontFamily: "var(--font-mono)", color: "var(--text-muted)", textTransform: "uppercase" }}>
                      {statusLabel(t.status)}
                    </span>
                  </div>
                  <div style={{ fontSize: 11, color: "var(--text-secondary)", marginBottom: 2 }}>{t.factoryName}</div>
                  <div style={{ display: "flex", gap: 10, fontSize: 10, color: "var(--text-muted)", fontFamily: "var(--font-mono)" }}>
                    <span>Deploy: {fmtDate(t.deploymentDate)}</span>
                    <span>SD: {t.sdCardsRequested}</span>
                  </div>
                  {tRuns.length > 0 && (
                    <div style={{ marginTop: 6 }}>
                      <div style={{ height: 3, background: "var(--border)", borderRadius: 2, overflow: "hidden" }}>
                        <div style={{ height: "100%", width: `${tPct}%`, background: tPct >= 100 ? "var(--success)" : "var(--text-primary)", transition: "width 0.3s" }} />
                      </div>
                      <div style={{ fontSize: 9, color: "var(--text-muted)", marginTop: 2, fontFamily: "var(--font-mono)" }}>
                        {tProcessed}/{tTotal} processed ({tRuns.length} batch{tRuns.length !== 1 ? "es" : ""})
                      </div>
                    </div>
                  )}
                </div>
              );
            })
          )}
        </div>

        {/* Detail pane */}
        <div style={{ flex: 1, overflowY: "auto", background: "var(--bg-subtle)" }}>
          {!selectedTicket ? (
            <div className="empty-state" style={{ height: "100%" }}>
              <div className="empty-state-icon">📋</div>
              <div className="empty-state-title">Select a ticket</div>
              <div className="empty-state-desc">Choose a ticket from the list to view details and log batches.</div>
            </div>
          ) : (
            <div style={{ padding: "16px", display: "flex", flexDirection: "column", gap: 14, maxWidth: 800, margin: "0 auto" }}>

              {/* Ticket info card */}
              <div className="panel anim-fade">
                <div className="panel-header">
                  <span className="panel-title">{selectedTicket.title}</span>
                  <span className={`badge badge-${selectedTicket.status}`}>{statusLabel(selectedTicket.status)}</span>
                </div>
                <div style={{ padding: "12px 14px", display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(140px, 1fr))", gap: "8px 16px" }}>
                  <InfoRow label="Team" value={selectedTicket.teamName} />
                  <InfoRow label="Factory" value={selectedTicket.factoryName} />
                  <InfoRow label="Deploy Date" value={fmtDate(selectedTicket.deploymentDate)} mono />
                  <InfoRow label="Workers" value={selectedTicket.workerCount} mono />
                  <InfoRow label="Total SD Cards" value={sdCardsTotal} mono />
                  <InfoRow label="Devices" value={selectedTicket.devicesRequested} mono />
                </div>
              </div>

              {/* Progress card */}
              {sdCardsTotal > 0 && (
                <div className="panel anim-fade" style={{ animationDelay: "0.05s" }}>
                  <div className="panel-header">
                    <span className="panel-title">Processing Progress</span>
                    <span style={{ fontFamily: "var(--font-mono)", fontSize: 11, color: progress >= 100 ? "var(--success)" : "var(--text-muted)" }}>
                      {progress}%
                    </span>
                  </div>
                  <div style={{ padding: "14px" }}>
                    {/* Big progress bar */}
                    <div style={{ height: 10, background: "var(--border)", borderRadius: 5, overflow: "hidden", marginBottom: 10 }}>
                      <div style={{
                        height: "100%", width: `${progress}%`,
                        background: progress >= 100 ? "var(--success)" : "var(--text-primary)",
                        borderRadius: 5, transition: "width 0.4s cubic-bezier(0.34, 1.56, 0.64, 1)",
                      }} />
                    </div>
                    <div style={{ display: "grid", gridTemplateColumns: "repeat(4, 1fr)", gap: 8 }}>
                      <StatBox label="Good Cards" value={processed} color="var(--success)" />
                      <StatBox label="Bad Cards" value={bad} color="var(--warning)" />
                      <StatBox label="Missing" value={missing} color="var(--error)" />
                      <StatBox label="Remaining" value={remaining} color={remaining > 0 ? "var(--text-primary)" : "var(--text-muted)"} />
                    </div>
                    {runs.length > 0 && (
                      <div style={{ marginTop: 8, fontSize: 11, color: "var(--text-muted)", fontFamily: "var(--font-mono)" }}>
                        Total expected across {runs.length} batch{runs.length !== 1 ? "es" : ""}: {expected} SD cards
                      </div>
                    )}
                  </div>
                </div>
              )}

              {/* Error banner */}
              {error && (
                <div className="alert alert-error" style={{ fontSize: 12, padding: "8px 12px" }}>{error}</div>
              )}

              {/* Actions */}
              {canAddBatch && selectedTicket.status !== "ingestion_completed" && selectedTicket.status !== "closed" && (
                <div className="panel anim-fade" style={{ animationDelay: "0.08s" }}>
                  <div className="panel-header">
                    <span className="panel-title">Actions</span>
                  </div>
                  <div style={{ padding: "12px 14px", display: "flex", gap: 8, flexWrap: "wrap" }}>
                    {selectedTicket.status === "transferred_to_ingestion" && (
                      <>
                        <div style={{ width: "100%", padding: "8px 10px", background: "#fff8e1", border: "1px solid #f59e0b", borderRadius: 4, fontSize: 11, color: "#92400e", marginBottom: 4 }}>
                          ⚠️ Confirm you have physically received the SD card packets from Logistics before starting.
                        </div>
                        <button onClick={() => void handleMarkTransferred()} className="btn btn-primary" disabled={loading} style={{ fontSize: 12 }}>
                          {loading ? "Working…" : "📦 Received SD Cards — Start Processing"}
                        </button>
                      </>
                    )}
                    {(selectedTicket.status === "transferred_to_ingestion" || selectedTicket.status === "ingestion_processing") && (
                      <button
                        onClick={() => setShowBatchForm((v) => !v)}
                        className="btn btn-primary"
                        style={{ fontSize: 12 }}
                      >
                        {showBatchForm ? "✕ Cancel Batch" : "+ Log New Batch"}
                      </button>
                    )}
                  </div>
                </div>
              )}

              {/* Batch add form */}
              {showBatchForm && (
                <div className="panel anim-slide-down">
                  <div className="panel-header">
                    <span className="panel-title">Log Processing Batch {runs.length + 1}</span>
                  </div>
                  <div style={{ padding: "14px" }}>
                    {/* QR Code scan field */}
                    <div className="form-group" style={{ marginBottom: 12 }}>
                      <label className="form-label">Scan QR Code (optional)</label>
                      <div style={{ display: "flex", gap: 8 }}>
                        <input
                          className="input"
                          placeholder="Scan or paste QR code / package ID..."
                          value={form.qrCode}
                          onChange={(e) => handleQrScan(e.target.value)}
                          style={{ flex: 1, fontSize: 12, fontFamily: "var(--font-mono)" }}
                          autoFocus
                        />
                        {form.qrCode && (
                          <button
                            onClick={() => setForm((f) => ({ ...f, qrCode: "", packageLabel: "" }))}
                            style={{ padding: "0 10px", fontSize: 12, border: "1px solid var(--border)", background: "transparent", cursor: "pointer" }}
                          >✕</button>
                        )}
                      </div>
                      <div style={{ fontSize: 10, color: "var(--text-muted)", marginTop: 3 }}>
                        Click the field and scan using your QR scanner — it will auto-fill
                      </div>
                    </div>

                    {/* Package label */}
                    <div className="form-group" style={{ marginBottom: 12 }}>
                      <label className="form-label">Package / Batch Label (optional)</label>
                      <input
                        className="input"
                        placeholder="e.g. Box 1, Pouch A, Day-1 packet..."
                        value={form.packageLabel}
                        onChange={(e) => setForm((f) => ({ ...f, packageLabel: e.target.value }))}
                        style={{ fontSize: 12 }}
                      />
                    </div>

                    <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr 1fr", gap: 10, marginBottom: 12 }}>
                      <div className="form-group">
                        <label className="form-label">Total in Packet</label>
                        <input
                          type="number" className="input" min={0}
                          style={{ fontFamily: "var(--font-mono)", fontSize: 13, fontWeight: 700 }}
                          value={form.totalInPacket || ""}
                          onChange={(e) => setForm((f) => ({ ...f, totalInPacket: Math.max(0, parseInt(e.target.value, 10) || 0) }))}
                          placeholder="0"
                        />
                      </div>
                      <div className="form-group">
                        <label className="form-label" style={{ color: "var(--success)" }}>✓ Good Cards</label>
                        <input
                          type="number" className="input" min={0}
                          style={{ fontFamily: "var(--font-mono)", fontSize: 13, fontWeight: 700 }}
                          value={form.goodSdCards || ""}
                          onChange={(e) => setForm((f) => ({ ...f, goodSdCards: Math.max(0, parseInt(e.target.value, 10) || 0) }))}
                          placeholder="0"
                        />
                      </div>
                      <div className="form-group">
                        <label className="form-label" style={{ color: "var(--warning)" }}>⚠ Bad / Faulty</label>
                        <input
                          type="number" className="input" min={0}
                          style={{ fontFamily: "var(--font-mono)", fontSize: 13, fontWeight: 700 }}
                          value={form.badSdCards || ""}
                          onChange={(e) => setForm((f) => ({ ...f, badSdCards: Math.max(0, parseInt(e.target.value, 10) || 0) }))}
                          placeholder="0"
                        />
                      </div>
                    </div>

                    {/* Auto-calculated missing */}
                    <div className="form-group" style={{ marginBottom: 12 }}>
                      <label className="form-label" style={{ color: autoMissing > 0 ? "var(--error)" : undefined }}>
                        ✗ Missing (auto-calculated)
                      </label>
                      <div style={{
                        padding: "9px 12px", border: "1px solid var(--border)",
                        background: "var(--bg-muted)", fontFamily: "var(--font-mono)",
                        fontSize: 16, fontWeight: 700,
                        color: autoMissing > 0 ? "var(--error)" : "var(--text-muted)",
                      }}>
                        {autoMissing}
                        <span style={{ fontSize: 10, color: "var(--text-muted)", marginLeft: 8, fontWeight: 400 }}>
                          = Total ({form.totalInPacket}) − Good ({form.goodSdCards}) − Bad ({form.badSdCards})
                        </span>
                      </div>
                    </div>

                    {/* Summary box */}
                    {form.totalInPacket > 0 && (
                      <div style={{
                        background: "var(--bg-muted)", border: "1px solid var(--border)",
                        padding: "10px 12px", marginBottom: 12, fontSize: 11,
                        display: "grid", gridTemplateColumns: "1fr 1fr 1fr 1fr", gap: 4,
                      }}>
                        <SumBox label="Total" value={form.totalInPacket} />
                        <SumBox label="Good" value={form.goodSdCards} color="var(--success)" />
                        <SumBox label="Bad" value={form.badSdCards} color="var(--warning)" />
                        <SumBox label="Missing" value={autoMissing} color={autoMissing > 0 ? "var(--error)" : "var(--text-muted)"} />
                      </div>
                    )}

                    <div className="form-group" style={{ marginBottom: 12 }}>
                      <label className="form-label">Notes</label>
                      <textarea
                        className="textarea"
                        placeholder="Observations, anything unusual..."
                        value={form.notes}
                        onChange={(e) => setForm((f) => ({ ...f, notes: e.target.value }))}
                        style={{ fontSize: 12, minHeight: 60 }}
                      />
                    </div>

                    <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
                      <button
                        onClick={() => void submitBatch(false)}
                        className="btn btn-primary"
                        disabled={loading || form.totalInPacket < 1}
                        style={{ flex: 1, fontSize: 12 }}
                      >
                        {loading ? "Saving..." : "Save Batch (Continue Later)"}
                      </button>
                      {canComplete && (
                        <button
                          onClick={() => void submitBatch(true)}
                          className="btn btn-secondary"
                          disabled={loading || form.totalInPacket < 1}
                          style={{ flex: 1, fontSize: 12, background: "var(--success)", color: "#fff", borderColor: "var(--success)" }}
                        >
                          {loading ? "Saving..." : "Save & Mark Ingestion Done"}
                        </button>
                      )}
                    </div>
                  </div>
                </div>
              )}

              {/* Batch run history */}
              {runs.length > 0 && (
                <div className="panel anim-fade" style={{ animationDelay: "0.1s" }}>
                  <div className="panel-header">
                    <span className="panel-title">Processing Batches</span>
                    <span style={{ fontSize: 10, color: "var(--text-muted)", fontFamily: "var(--font-mono)" }}>
                      {runs.length} batch{runs.length !== 1 ? "es" : ""}
                    </span>
                  </div>
                  <div>
                    {runs.map((run, idx) => (
                      <div
                        key={run.id}
                        style={{
                          padding: "12px 14px",
                          borderBottom: idx < runs.length - 1 ? "1px solid var(--border)" : "none",
                        }}
                      >
                        <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 6 }}>
                          <div style={{
                            width: 24, height: 24, borderRadius: "50%", display: "flex", alignItems: "center", justifyContent: "center",
                            background: "var(--bg-muted)", border: "1px solid var(--border)",
                            fontSize: 10, fontWeight: 700, fontFamily: "var(--font-mono)", flexShrink: 0,
                          }}>
                            {run.runNumber}
                          </div>
                          <div style={{ flex: 1 }}>
                            <div style={{ fontSize: 12, fontWeight: 600, color: "var(--text-primary)" }}>
                              {run.packageLabel ? `Batch ${run.runNumber} — ${run.packageLabel}` : `Batch ${run.runNumber}`}
                            </div>
                            <div style={{ fontSize: 10, color: "var(--text-muted)", fontFamily: "var(--font-mono)" }}>
                              {fmtTime(run.processedAt)} · {run.processedByName || run.processedBy}
                            </div>
                          </div>
                          <div style={{ textAlign: "right" }}>
                            <div style={{ fontSize: 13, fontWeight: 700, fontFamily: "var(--font-mono)", color: "var(--text-primary)" }}>
                              {run.totalInPacket}
                            </div>
                            <div style={{ fontSize: 9, color: "var(--text-muted)", textTransform: "uppercase" }}>in packet</div>
                          </div>
                        </div>

                        {/* Counts */}
                        <div style={{ display: "flex", gap: 6, flexWrap: "wrap", marginBottom: run.qrCode || run.notes ? 6 : 0 }}>
                          <BatchTag label="Good" value={run.goodSdCards} color="var(--success)" />
                          <BatchTag label="Bad" value={run.badSdCards} color="var(--warning)" />
                          <BatchTag label="Missing" value={run.missingSdCards} color={run.missingSdCards > 0 ? "var(--error)" : "var(--text-muted)"} />
                        </div>

                        {run.qrCode && (
                          <div style={{ fontSize: 10, color: "var(--text-muted)", fontFamily: "var(--font-mono)", marginBottom: 3 }}>
                            QR: {run.qrCode}
                          </div>
                        )}
                        {run.notes && (
                          <div style={{ fontSize: 11, color: "var(--text-secondary)", marginTop: 4, paddingLeft: 32 }}>
                            {run.notes}
                          </div>
                        )}
                      </div>
                    ))}
                  </div>
                </div>
              )}

              {/* Empty runs state */}
              {runs.length === 0 && selectedTicket.status === "ingestion_processing" && (
                <div style={{
                  padding: "20px 16px", textAlign: "center", border: "1px dashed var(--border)",
                  color: "var(--text-muted)", fontSize: 12,
                }}>
                  No batches logged yet. Use &quot;Log New Batch&quot; to record the first processing run.
                </div>
              )}

              {/* Completion state */}
              {selectedTicket.status === "ingestion_completed" && (
                <div className="alert alert-success" style={{ fontSize: 12 }}>
                  ✓ Ingestion completed for this ticket. Processed {processed} good SD cards across {runs.length} batch{runs.length !== 1 ? "es" : ""}.
                  {bad > 0 && ` ${bad} faulty.`}
                  {missing > 0 && ` ${missing} missing.`}
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
      <span style={{ fontSize: 9, color: "var(--text-muted)", fontFamily: "var(--font-mono)", textTransform: "uppercase", letterSpacing: "0.06em" }}>
        {label}
      </span>
      <span style={{ fontSize: 13, color: "var(--text-primary)", fontFamily: mono ? "var(--font-mono)" : undefined, fontWeight: 500 }}>
        {value}
      </span>
    </div>
  );
}

function StatBox({ label, value, color }: { label: string; value: number; color: string }) {
  return (
    <div style={{ textAlign: "center", padding: "8px 4px", background: "var(--bg-muted)", border: "1px solid var(--border)", borderRadius: 4 }}>
      <div style={{ fontSize: 18, fontWeight: 700, fontFamily: "var(--font-mono)", color }}>{value}</div>
      <div style={{ fontSize: 9, color: "var(--text-muted)", textTransform: "uppercase", letterSpacing: "0.05em" }}>{label}</div>
    </div>
  );
}

function SumBox({ label, value, color }: { label: string; value: number; color?: string }) {
  return (
    <div style={{ textAlign: "center" }}>
      <div style={{ fontSize: 14, fontWeight: 700, fontFamily: "var(--font-mono)", color: color ?? "var(--text-primary)" }}>{value}</div>
      <div style={{ fontSize: 9, color: "var(--text-muted)", textTransform: "uppercase" }}>{label}</div>
    </div>
  );
}

function BatchTag({ label, value, color }: { label: string; value: number; color: string }) {
  return (
    <span style={{
      padding: "2px 8px", fontSize: 10, border: "1px solid", borderColor: color,
      color, borderRadius: 100, fontFamily: "var(--font-mono)", display: "inline-flex", gap: 4,
    }}>
      <span style={{ opacity: 0.7 }}>{label}</span>
      <strong>{value}</strong>
    </span>
  );
}
