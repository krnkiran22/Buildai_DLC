"use client";

import { useState } from "react";
import { updateAdminInventoryItem } from "@/lib/backend";
import type {
  AdminInventoryItem,
  AdminInventoryPatch,
  AuthSession,
  DashboardSnapshot,
} from "@/lib/operations-types";

type Props = {
  snapshot: DashboardSnapshot;
  session: AuthSession;
};

function statusBadge(status: string) {
  if (status === "critical") return <span className="badge badge-rejected">Critical</span>;
  if (status === "low_stock") return <span className="badge badge-ingestion_processing">Low Stock</span>;
  return <span className="badge badge-accepted">Healthy</span>;
}

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

      <div style={{ flex: 1, overflow: "hidden", display: "flex" }}>
        {/* Table */}
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
                  <tr
                    key={item.id}
                    style={{ background: editId === item.id ? "var(--bg-muted)" : undefined }}
                  >
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
    </div>
  );
}
