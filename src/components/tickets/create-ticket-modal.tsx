"use client";

import { useState } from "react";
import { createTicket } from "@/lib/backend";
import type { AuthSession, Priority, TicketCreateInput, TicketRecord, TicketType } from "@/lib/operations-types";

type Props = {
  session: AuthSession;
  onCreated: (ticket: TicketRecord) => void;
  onClose: () => void;
};

export function CreateTicketModal({ session, onCreated, onClose }: Props) {
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [titleEdited, setTitleEdited] = useState(false);
  const [form, setForm] = useState<{
    ticketType: TicketType;
    teamName: string;
    factoryName: string;
    sourceTeamName: string;
    sourceFactoryName: string;
    linkedTicketId: string;
    deploymentDate: string;
    workerCount: number;
    devicesRequested: number;
    sdCardsRequested: number;
    priority: Priority;
    notes: string;
    title: string;
  }>({
    ticketType: "deployment",
    teamName: "",
    factoryName: "",
    sourceTeamName: "",
    sourceFactoryName: "",
    linkedTicketId: "",
    deploymentDate: new Date().toISOString().slice(0, 10),
    workerCount: 0,
    devicesRequested: 0,
    sdCardsRequested: 0,
    priority: "medium",
    notes: "",
    title: "",
  });

  function set<K extends keyof typeof form>(key: K, value: (typeof form)[K]) {
    setForm((f) => {
      const next = { ...f, [key]: value };
      // Auto-update title whenever form fields change, unless user manually edited it
      if (key !== "title" && !titleEdited) {
        const t = (key === "teamName" ? String(value) : f.teamName) || "[Team]";
        const fc = (key === "factoryName" ? String(value) : f.factoryName) || "[Factory]";
        const d = (key === "deploymentDate" ? String(value) : f.deploymentDate) || "[Date]";
        const dev = key === "devicesRequested" ? Number(value) : f.devicesRequested;
        const sd = key === "sdCardsRequested" ? Number(value) : f.sdCardsRequested;
        next.title = `${t} | ${fc} | Deploy ${d} | Devices ${dev} | SD ${sd}`;
      }
      return next;
    });
  }

  function handleTitleChange(val: string) {
    setTitleEdited(true);
    setForm((f) => ({ ...f, title: val }));
  }

  function resetTitle() {
    setTitleEdited(false);
    const t = form.teamName || "[Team]";
    const f2 = form.factoryName || "[Factory]";
    const d = form.deploymentDate || "[Date]";
    setForm((f) => ({ ...f, title: `${t} | ${f2} | Deploy ${d} | Devices ${f.devicesRequested} | SD ${f.sdCardsRequested}` }));
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError("");
    if (!form.teamName) { setError("Team name is required."); return; }
    if (!form.factoryName) { setError("Factory name is required."); return; }
    if (!form.deploymentDate) { setError("Deployment date is required."); return; }

    const payload: TicketCreateInput = {
      ticketType: form.ticketType,
      teamName: form.teamName,
      factoryName: form.factoryName,
      deploymentDate: form.deploymentDate,
      workerCount: form.workerCount,
      devicesRequested: form.devicesRequested,
      sdCardsRequested: form.sdCardsRequested,
      priority: form.priority,
      title: form.title || undefined,
    };
    if (form.ticketType === "transfer") {
      if (form.sourceTeamName) payload.sourceTeamName = form.sourceTeamName;
      if (form.sourceFactoryName) payload.sourceFactoryName = form.sourceFactoryName;
      if (form.linkedTicketId) payload.linkedTicketId = form.linkedTicketId;
    }

    setLoading(true);
    try {
      const ticket = await createTicket(payload, session);
      if (ticket) onCreated(ticket);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to create ticket.");
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="modal-backdrop" onClick={(e) => { if (e.target === e.currentTarget) onClose(); }}>
      <div className="modal-box" style={{ maxWidth: 580 }}>
        <div className="modal-header">
          <div>
            <div style={{ fontSize: 14, fontWeight: 700, color: "var(--text-primary)" }}>New Ticket Request</div>
            <div style={{ fontSize: 11, color: "var(--text-muted)", marginTop: 2 }}>
              Title auto-fills as you type — you can edit it anytime
            </div>
          </div>
          <button onClick={onClose} style={{ fontSize: 20, color: "var(--text-muted)", background: "none", border: "none", cursor: "pointer", lineHeight: 1 }}>×</button>
        </div>

        <form onSubmit={handleSubmit} style={{ display: "flex", flexDirection: "column", overflow: "hidden" }}>
          <div className="modal-body">
            {error && <div className="alert alert-error">{error}</div>}

            {/* Ticket title — editable, auto-filled from form fields */}
            <div className="form-group" style={{ marginBottom: 4 }}>
              <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 4 }}>
                <label className="form-label" style={{ margin: 0 }}>Ticket Title</label>
                {titleEdited && (
                  <button
                    type="button"
                    onClick={resetTitle}
                    style={{ fontSize: 10, color: "var(--text-muted)", background: "none", border: "none", cursor: "pointer", textDecoration: "underline" }}
                  >
                    Reset to auto
                  </button>
                )}
              </div>
              <input
                className="input"
                style={{ fontFamily: "var(--font-mono)", fontSize: 12 }}
                value={form.title}
                onChange={(e) => handleTitleChange(e.target.value)}
                placeholder="Title will auto-fill as you type below…"
              />
              {!titleEdited && (
                <div style={{ fontSize: 10, color: "var(--text-muted)", marginTop: 3 }}>
                  Auto-generated from your inputs — click to edit
                </div>
              )}
            </div>

            {/* Ticket type */}
            <div className="form-group">
              <label className="form-label">Ticket Type</label>
              <div style={{ display: "flex", gap: 8 }}>
                {(["deployment", "transfer"] as TicketType[]).map((t) => (
                  <button
                    key={t}
                    type="button"
                    onClick={() => set("ticketType", t)}
                    style={{
                      flex: 1, padding: "7px", fontSize: 12, fontWeight: form.ticketType === t ? 700 : 400,
                      border: `1px solid ${form.ticketType === t ? "var(--action)" : "var(--border)"}`,
                      background: form.ticketType === t ? "var(--action)" : "var(--bg)",
                      color: form.ticketType === t ? "var(--action-text)" : "var(--text-secondary)",
                      cursor: "pointer", textTransform: "capitalize",
                    }}
                  >
                    {t}
                  </button>
                ))}
              </div>
            </div>

            <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 12 }}>
              <div className="form-group">
                <label className="form-label">Team Name *</label>
                <input className="input" placeholder="e.g. Tata Team A" value={form.teamName} onChange={(e) => set("teamName", e.target.value)} />
              </div>
              <div className="form-group">
                <label className="form-label">Factory Name *</label>
                <input className="input" placeholder="e.g. Pune Factory 2" value={form.factoryName} onChange={(e) => set("factoryName", e.target.value)} />
              </div>
            </div>

            {form.ticketType === "transfer" && (
              <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 12, padding: "10px 12px", border: "1px solid var(--border)", background: "var(--bg-subtle)" }}>
                <div style={{ gridColumn: "1 / -1", fontSize: 10, color: "var(--text-muted)", fontFamily: "var(--font-mono)", textTransform: "uppercase", letterSpacing: "0.06em" }}>
                  Transfer Details
                </div>
                <div className="form-group">
                  <label className="form-label">Source Team</label>
                  <input className="input" placeholder="Origin team" value={form.sourceTeamName} onChange={(e) => set("sourceTeamName", e.target.value)} />
                </div>
                <div className="form-group">
                  <label className="form-label">Source Factory</label>
                  <input className="input" placeholder="Origin factory" value={form.sourceFactoryName} onChange={(e) => set("sourceFactoryName", e.target.value)} />
                </div>
                <div className="form-group" style={{ gridColumn: "1 / -1" }}>
                  <label className="form-label">Linked Ticket ID</label>
                  <input className="input" placeholder="Original ticket ID (optional)" value={form.linkedTicketId} onChange={(e) => set("linkedTicketId", e.target.value)} />
                </div>
              </div>
            )}

            <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr 1fr", gap: 12 }}>
              <div className="form-group">
                <label className="form-label">Deploy Date *</label>
                <input type="date" className="input" value={form.deploymentDate} onChange={(e) => set("deploymentDate", e.target.value)} />
              </div>
              <div className="form-group">
                <label className="form-label">Worker Count</label>
                <input type="number" className="input" min={0} value={form.workerCount} onChange={(e) => set("workerCount", parseInt(e.target.value, 10) || 0)} />
              </div>
              <div className="form-group">
                <label className="form-label">Priority</label>
                <select className="select" value={form.priority} onChange={(e) => set("priority", e.target.value as Priority)}>
                  <option value="high">High</option>
                  <option value="medium">Medium</option>
                  <option value="low">Low</option>
                </select>
              </div>
            </div>

            <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 12 }}>
              <div className="form-group">
                <label className="form-label">Devices Requested</label>
                <input type="number" className="input" min={0} value={form.devicesRequested} onChange={(e) => set("devicesRequested", parseInt(e.target.value, 10) || 0)} />
              </div>
              <div className="form-group">
                <label className="form-label">SD Cards Requested</label>
                <input type="number" className="input" min={0} value={form.sdCardsRequested} onChange={(e) => set("sdCardsRequested", parseInt(e.target.value, 10) || 0)} />
              </div>
            </div>
          </div>

          <div className="modal-footer">
            <button type="button" onClick={onClose} className="btn btn-secondary">Cancel</button>
            <button type="submit" className="btn btn-primary" disabled={loading}>
              {loading ? <><span className="spinner" style={{ borderTopColor: "white" }} /> Creating...</> : "Create Ticket"}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
