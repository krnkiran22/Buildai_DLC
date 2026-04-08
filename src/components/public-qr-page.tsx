"use client";

import { useEffect, useState } from "react";
import { getQrPackageDetail, qrSvgUrl, updateQrPackageDetail } from "@/lib/backend";
import type { PublicQrPackagePatch, QrPackageDetail } from "@/lib/operations-types";
import { printQrSticker } from "@/lib/print-sticker";

type Props = {
  qrToken: string;
};

function formatDate(s?: string | null) {
  if (!s) return "—";
  try { return new Date(s).toLocaleDateString("en-GB", { day: "2-digit", month: "short", year: "numeric" }); } catch { return s; }
}

function isLocked(detail: QrPackageDetail): boolean {
  if (!detail.editable) return true;
  if (!detail.editWindowExpiresAt) return false;
  return new Date() > new Date(detail.editWindowExpiresAt);
}

export function PublicQrPage({ qrToken }: Props) {
  const [detail, setDetail] = useState<QrPackageDetail | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [editing, setEditing] = useState(false);
  const [saving, setSaving] = useState(false);
  const [saveError, setSaveError] = useState("");
  const [saveSuccess, setSaveSuccess] = useState(false);
  const [form, setForm] = useState<PublicQrPackagePatch>({});

  useEffect(() => {
    let active = true;
    setLoading(true);
    getQrPackageDetail(qrToken).then((d) => {
      if (!active) return;
      if (d) {
        setDetail(d);
        setForm({
          teamName: d.teamName,
          factoryName: d.factoryName,
          deploymentDate: d.deploymentDate,
          receivedSdCardsCount: d.package.receivedSdCardsCount ?? undefined,
          receivedDevicesCount: d.package.receivedDevicesCount ?? undefined,
          receivedUsbHubsCount: d.package.receivedUsbHubsCount ?? undefined,
          receivedCablesCount: d.package.receivedCablesCount ?? undefined,
          note: d.package.note ?? "",
        });
      } else {
        setError("Package not found for this QR code.");
      }
    }).catch((err) => {
      if (!active) return;
      setError(err instanceof Error ? err.message : "Failed to load QR package.");
    }).finally(() => {
      if (active) setLoading(false);
    });
    return () => { active = false; };
  }, [qrToken]);

  async function handleSave(e: React.FormEvent) {
    e.preventDefault();
    setSaveError("");
    setSaveSuccess(false);
    setSaving(true);
    try {
      const updated = await updateQrPackageDetail(qrToken, form);
      if (updated) {
        setDetail(updated);
        setEditing(false);
        setSaveSuccess(true);
        setTimeout(() => setSaveSuccess(false), 3000);
      }
    } catch (err) {
      setSaveError(err instanceof Error ? err.message : "Save failed.");
    } finally {
      setSaving(false);
    }
  }

  if (loading) {
    return (
      <div style={{ minHeight: "100vh", display: "flex", alignItems: "center", justifyContent: "center", background: "var(--bg)" }}>
        <div style={{ display: "flex", alignItems: "center", gap: 8, color: "var(--text-muted)", fontSize: 13 }}>
          <span className="spinner" /> Loading package...
        </div>
      </div>
    );
  }

  if (error || !detail) {
    return (
      <div style={{ minHeight: "100vh", display: "flex", alignItems: "center", justifyContent: "center", background: "var(--bg)", padding: 24 }}>
        <div style={{ maxWidth: 360, textAlign: "center" }}>
          <div style={{ fontSize: 32, marginBottom: 12 }}>⚠</div>
          <div style={{ fontSize: 16, fontWeight: 700, color: "var(--text-primary)", marginBottom: 6 }}>Package Not Found</div>
          <div style={{ fontSize: 13, color: "var(--text-muted)" }}>{error || "This QR code does not match any package in the system."}</div>
        </div>
      </div>
    );
  }

  const locked = isLocked(detail);
  const pkg = detail.package;

  return (
    <div style={{ minHeight: "100vh", background: "var(--bg-subtle)", padding: "24px 16px" }}>
      <div style={{ maxWidth: 520, margin: "0 auto" }}>
        {/* Brand header */}
        <div style={{ marginBottom: 20, paddingBottom: 16, borderBottom: "1px solid var(--border)", display: "flex", alignItems: "center", justifyContent: "space-between" }}>
          <div>
            <div style={{ fontSize: 16, fontWeight: 800, color: "var(--text-primary)", letterSpacing: "-0.02em" }}>Build AI</div>
            <div style={{ fontSize: 10, color: "var(--text-muted)", fontFamily: "var(--font-mono)", textTransform: "uppercase", letterSpacing: "0.06em", marginTop: 1 }}>
              QR Package Record
            </div>
          </div>
          <button
            onClick={() => detail && printQrSticker({
              qrToken: qrToken,
              packageCode: detail.package.packageCode,
              title: detail.title,
              teamName: detail.teamName,
              factoryName: detail.factoryName,
              deploymentDate: detail.deploymentDate,
              devices: detail.package.shippedDevicesCount,
              sdCards: detail.package.shippedSdCardsCount,
              cables: detail.package.shippedCablesCount,
              usbHubs: detail.package.shippedUsbHubsCount,
              direction: detail.package.direction,
              qrImageUrl: qrSvgUrl(qrToken),
            })}
            disabled={!detail}
            style={{
              padding: "8px 16px", background: "#111", color: "#fff",
              border: "none", fontSize: 12, fontWeight: 700, cursor: "pointer",
              borderRadius: 6, display: "flex", alignItems: "center", gap: 6,
              opacity: detail ? 1 : 0.4,
            }}
          >
            🖨 Print Label
          </button>
        </div>

        {/* QR + identity */}
        <div className="panel" style={{ marginBottom: 12 }}>
          <div className="panel-header">
            <span className="panel-title">Package Identity</span>
            <span className="mono" style={{ fontSize: 10, color: "var(--text-muted)" }}>{pkg.packageCode}</span>
          </div>
          <div style={{ padding: "14px", display: "flex", gap: 16, alignItems: "flex-start" }}>
            {/* QR code */}
            <div style={{ flexShrink: 0 }}>
              <img
                src={qrSvgUrl(qrToken)}
                alt="QR Code"
                width={100}
                height={100}
                style={{ display: "block", border: "1px solid var(--border)" }}
                onError={(e) => { (e.target as HTMLImageElement).style.display = "none"; }}
              />
            </div>
            {/* Details */}
            <div style={{ flex: 1, display: "flex", flexDirection: "column", gap: 8 }}>
              <QrRow label="Team" value={detail.teamName} />
              <QrRow label="Factory" value={detail.factoryName} />
              <QrRow label="Deploy Date" value={formatDate(detail.deploymentDate)} mono />
              <QrRow label="QR Token" value={<span className="mono" style={{ fontSize: 10, wordBreak: "break-all" }}>{qrToken}</span>} />
            </div>
          </div>
        </div>

        {/* Shipped quantities */}
        <div className="panel" style={{ marginBottom: 12 }}>
          <div className="panel-header">
            <span className="panel-title">Shipped Quantities</span>
          </div>
          <div style={{ padding: "12px 14px", display: "grid", gridTemplateColumns: "1fr 1fr", gap: "6px 16px" }}>
            <QrRow label="Devices" value={pkg.shippedDevicesCount} mono />
            <QrRow label="SD Cards" value={pkg.shippedSdCardsCount} mono />
            <QrRow label="USB Hubs" value={pkg.shippedUsbHubsCount} mono />
            <QrRow label="Cables" value={pkg.shippedCablesCount} mono />
          </div>
        </div>

        {/* Received quantities */}
        <div className="panel" style={{ marginBottom: 12 }}>
          <div className="panel-header">
            <span className="panel-title">Received at Factory</span>
          </div>
          <div style={{ padding: "12px 14px", display: "grid", gridTemplateColumns: "1fr 1fr", gap: "6px 16px" }}>
            <QrRow label="Devices" value={pkg.receivedDevicesCount ?? "Not confirmed"} mono={typeof pkg.receivedDevicesCount === "number"} />
            <QrRow label="SD Cards" value={pkg.receivedSdCardsCount ?? "Not confirmed"} mono={typeof pkg.receivedSdCardsCount === "number"} />
            <QrRow label="USB Hubs" value={pkg.receivedUsbHubsCount ?? "Not confirmed"} mono={typeof pkg.receivedUsbHubsCount === "number"} />
            <QrRow label="Cables" value={pkg.receivedCablesCount ?? "Not confirmed"} mono={typeof pkg.receivedCablesCount === "number"} />
          </div>
        </div>

        {/* Edit section */}
        {saveSuccess && <div className="alert alert-success" style={{ marginBottom: 12 }}>✓ Package updated successfully.</div>}

        {locked ? (
          <div style={{ padding: "16px", border: "1px solid var(--border)", background: "var(--bg-muted)", textAlign: "center", marginBottom: 12 }}>
            <div style={{ fontSize: 14, fontWeight: 700, color: "var(--text-muted)", marginBottom: 4 }}>Locked: Contact Admin</div>
            <div style={{ fontSize: 11, color: "var(--text-muted)" }}>
              {detail.lockedReason ?? "Edit window has closed for this package."}
            </div>
          </div>
        ) : (
          <>
            {!editing ? (
              <button onClick={() => setEditing(true)} className="btn btn-primary" style={{ width: "100%", marginBottom: 12 }}>
                Edit Package Details
              </button>
            ) : (
              <div className="panel" style={{ marginBottom: 12 }}>
                <div className="panel-header">
                  <span className="panel-title">Edit Details</span>
                  <div style={{ fontSize: 10, color: "var(--text-muted)" }}>
                    {detail.editWindowExpiresAt && (
                      <>Editable until: <span className="mono">{formatDate(detail.editWindowExpiresAt)}</span></>
                    )}
                  </div>
                </div>
                <form onSubmit={handleSave} style={{ padding: "14px", display: "flex", flexDirection: "column", gap: 12 }}>
                  {saveError && <div className="alert alert-error" style={{ fontSize: 12 }}>{saveError}</div>}

                  <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 12 }}>
                    <div className="form-group">
                      <label className="form-label">Team Name</label>
                      <input className="input" value={form.teamName ?? ""} onChange={(e) => setForm((f) => ({ ...f, teamName: e.target.value }))} />
                    </div>
                    <div className="form-group">
                      <label className="form-label">Factory Name</label>
                      <input className="input" value={form.factoryName ?? ""} onChange={(e) => setForm((f) => ({ ...f, factoryName: e.target.value }))} />
                    </div>
                    <div className="form-group">
                      <label className="form-label">Deployment Date</label>
                      <input type="date" className="input" value={form.deploymentDate ?? ""} onChange={(e) => setForm((f) => ({ ...f, deploymentDate: e.target.value }))} />
                    </div>
                  </div>

                  <div style={{ borderTop: "1px solid var(--border)", paddingTop: 12 }}>
                    <div style={{ fontSize: 10, color: "var(--text-muted)", fontFamily: "var(--font-mono)", textTransform: "uppercase", letterSpacing: "0.06em", marginBottom: 8 }}>
                      Received Quantities
                    </div>
                    <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 12 }}>
                      <div className="form-group">
                        <label className="form-label">SD Cards Received</label>
                        <input type="number" className="input" min={0} style={{ fontFamily: "var(--font-mono)" }} value={form.receivedSdCardsCount ?? ""} onChange={(e) => setForm((f) => ({ ...f, receivedSdCardsCount: parseInt(e.target.value, 10) || 0 }))} />
                      </div>
                      <div className="form-group">
                        <label className="form-label">Devices Received</label>
                        <input type="number" className="input" min={0} style={{ fontFamily: "var(--font-mono)" }} value={form.receivedDevicesCount ?? ""} onChange={(e) => setForm((f) => ({ ...f, receivedDevicesCount: parseInt(e.target.value, 10) || 0 }))} />
                      </div>
                      <div className="form-group">
                        <label className="form-label">USB Hubs Received</label>
                        <input type="number" className="input" min={0} style={{ fontFamily: "var(--font-mono)" }} value={form.receivedUsbHubsCount ?? ""} onChange={(e) => setForm((f) => ({ ...f, receivedUsbHubsCount: parseInt(e.target.value, 10) || 0 }))} />
                      </div>
                      <div className="form-group">
                        <label className="form-label">Cables Received</label>
                        <input type="number" className="input" min={0} style={{ fontFamily: "var(--font-mono)" }} value={form.receivedCablesCount ?? ""} onChange={(e) => setForm((f) => ({ ...f, receivedCablesCount: parseInt(e.target.value, 10) || 0 }))} />
                      </div>
                    </div>
                  </div>

                  <div className="form-group">
                    <label className="form-label">Note</label>
                    <textarea className="textarea" style={{ fontSize: 13, minHeight: 60 }} placeholder="Any notes about this package..." value={form.note ?? ""} onChange={(e) => setForm((f) => ({ ...f, note: e.target.value }))} />
                  </div>

                  <div style={{ display: "flex", gap: 8 }}>
                    <button type="submit" className="btn btn-primary" disabled={saving} style={{ flex: 1 }}>
                      {saving ? <><span className="spinner" style={{ borderTopColor: "white" }} /> Saving...</> : "Save Changes"}
                    </button>
                    <button type="button" onClick={() => setEditing(false)} className="btn btn-secondary">Cancel</button>
                  </div>
                </form>
              </div>
            )}
          </>
        )}

        {/* Footer */}
        <div style={{ textAlign: "center", fontSize: 10, color: "var(--text-muted)", fontFamily: "var(--font-mono)", marginTop: 8 }}>
          Build AI Operations Platform · {pkg.packageCode}
        </div>
      </div>
    </div>
  );
}

function QrRow({ label, value, mono }: { label: string; value: React.ReactNode; mono?: boolean }) {
  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 2 }}>
      <span style={{ fontSize: 9, color: "var(--text-muted)", fontFamily: "var(--font-mono)", textTransform: "uppercase", letterSpacing: "0.06em" }}>{label}</span>
      <span style={{ fontSize: 13, color: "var(--text-primary)", fontFamily: mono ? "var(--font-mono)" : undefined, fontWeight: 500 }}>{value ?? "—"}</span>
    </div>
  );
}
