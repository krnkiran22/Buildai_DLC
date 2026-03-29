"use client";

import { useEffect, useState } from "react";
import { updateAdminInventoryItem } from "@/lib/backend";
import type {
  AdminInventoryItem,
  AdminInventoryPatch,
  AuthSession,
  BackendHealth,
  InventoryStatus,
} from "@/lib/operations-types";

type InventoryFormState = {
  totalUnits: string;
  availableUnits: string;
  allocatedUnits: string;
  inTransitUnits: string;
  ingestionUnits: string;
  missingUnits: string;
  reorderPoint: string;
  location: string;
  updatedBy: string;
  note: string;
};

function formatDateTime(value: string) {
  return new Intl.DateTimeFormat("en-US", {
    month: "short",
    day: "numeric",
    hour: "numeric",
    minute: "2-digit",
  }).format(new Date(value));
}

function inventoryTone(status: InventoryStatus) {
  switch (status) {
    case "healthy":
      return "status-success";
    case "low_stock":
      return "status-warning";
    case "critical":
      return "status-error";
  }
}

function inventoryLabel(status: InventoryStatus) {
  switch (status) {
    case "healthy":
      return "Healthy";
    case "low_stock":
      return "Low Stock";
    case "critical":
      return "Critical";
  }
}

function buildForm(item: AdminInventoryItem): InventoryFormState {
  return {
    totalUnits: String(item.totalUnits),
    availableUnits: String(item.availableUnits),
    allocatedUnits: String(item.allocatedUnits),
    inTransitUnits: String(item.inTransitUnits),
    ingestionUnits: String(item.ingestionUnits),
    missingUnits: String(item.missingUnits),
    reorderPoint: String(item.reorderPoint),
    location: item.location,
    updatedBy: item.updatedBy,
    note: item.note,
  };
}

function deriveStatus(item: AdminInventoryItem): InventoryStatus {
  if (item.availableUnits <= Math.max(Math.floor(item.reorderPoint / 2), 25) || item.missingUnits >= 50) {
    return "critical";
  }
  if (item.availableUnits <= item.reorderPoint || item.missingUnits > 0) {
    return "low_stock";
  }
  return "healthy";
}

export function AdminInventoryPanel({
  initialItems,
  health,
  session,
}: {
  initialItems: AdminInventoryItem[];
  health: BackendHealth;
  session: AuthSession | null;
}) {
  const [items, setItems] = useState(initialItems);
  const [selectedId, setSelectedId] = useState(initialItems[0]?.id ?? "");
  const [form, setForm] = useState<InventoryFormState | null>(
    initialItems[0] ? buildForm(initialItems[0]) : null,
  );
  const [saving, setSaving] = useState(false);
  const [feedback, setFeedback] = useState<string>("");

  const selectedItem = items.find((item) => item.id === selectedId) ?? items[0];

  useEffect(() => {
    setItems(initialItems);
    if (!initialItems.some((item) => item.id === selectedId)) {
      setSelectedId(initialItems[0]?.id ?? "");
    }
  }, [initialItems, selectedId]);

  useEffect(() => {
    if (!selectedItem) {
      return;
    }

    setForm(buildForm(selectedItem));
  }, [selectedItem]);

  function updateField(field: keyof InventoryFormState, value: string) {
    setForm((current) => (current ? { ...current, [field]: value } : current));
  }

  async function handleSave() {
    if (!selectedItem || !form) {
      return;
    }

    const patch: AdminInventoryPatch = {
      totalUnits: Number(form.totalUnits),
      availableUnits: Number(form.availableUnits),
      allocatedUnits: Number(form.allocatedUnits),
      inTransitUnits: Number(form.inTransitUnits),
      ingestionUnits: Number(form.ingestionUnits),
      missingUnits: Number(form.missingUnits),
      reorderPoint: Number(form.reorderPoint),
      location: form.location,
      updatedBy: form.updatedBy,
      note: form.note,
    };

    setSaving(true);
    setFeedback("");

    try {
      const updated = await updateAdminInventoryItem(selectedItem.id, patch, session);

      const nextItem: AdminInventoryItem = updated ?? {
        ...selectedItem,
        ...patch,
        updatedAt: new Date().toISOString(),
        status: deriveStatus({
          ...selectedItem,
          ...patch,
          updatedAt: new Date().toISOString(),
          totalUnits: patch.totalUnits ?? selectedItem.totalUnits,
          availableUnits: patch.availableUnits ?? selectedItem.availableUnits,
          allocatedUnits: patch.allocatedUnits ?? selectedItem.allocatedUnits,
          inTransitUnits: patch.inTransitUnits ?? selectedItem.inTransitUnits,
          ingestionUnits: patch.ingestionUnits ?? selectedItem.ingestionUnits,
          missingUnits: patch.missingUnits ?? selectedItem.missingUnits,
          reorderPoint: patch.reorderPoint ?? selectedItem.reorderPoint,
          location: patch.location ?? selectedItem.location,
          updatedBy: patch.updatedBy ?? selectedItem.updatedBy,
          note: patch.note ?? selectedItem.note,
          status: selectedItem.status,
        }),
      };

      setItems((current) =>
        current.map((item) => (item.id === selectedItem.id ? nextItem : item)),
      );
      setFeedback(
        updated
          ? "Inventory item saved to the backend."
          : "Saved locally. Set NEXT_PUBLIC_OPERATIONS_API_BASE_URL to persist to the backend.",
      );
    } catch (error) {
      const message = error instanceof Error ? error.message : "Failed to save inventory item.";
      setFeedback(message);
    } finally {
      setSaving(false);
    }
  }

  return (
    <section className="panel-shell overflow-hidden">
      <div className="grid gap-6 border-b border-[color:var(--border)] px-5 py-4 lg:grid-cols-[1.2fr_0.8fr]">
        <div>
          <span className="font-mono text-[11px] font-semibold uppercase tracking-[0.24em] text-[color:var(--muted-foreground)]">
            Admin Inventory
          </span>
          <h2 className="mt-2 text-xl font-semibold tracking-[-0.03em] text-[color:var(--foreground)]">
            Stock editing is admin-owned
          </h2>
          <p className="mt-2 max-w-3xl text-sm leading-6 text-[color:var(--muted-foreground)]">
            Admin can see the current inventory state, adjust counts, change storage
            location, update reorder points, and reconcile shortages directly from the dashboard.
          </p>
        </div>
        <div className="border border-[color:var(--border)] bg-white/75 p-4">
          <p className="text-[11px] uppercase tracking-[0.16em] text-[color:var(--muted-foreground)]">
            Backend health
          </p>
          <div className="mt-3 flex items-center gap-3">
            <span
              className={`inline-flex items-center border px-2.5 py-1 text-[11px] font-semibold uppercase tracking-[0.16em] ${
                health.ok ? "status-success" : "status-error"
              }`}
            >
              {health.ok ? "Healthy" : "Down"}
            </span>
            <span className="font-mono text-[11px] uppercase tracking-[0.14em] text-[color:var(--muted-foreground)]">
              {health.environment}
            </span>
          </div>
          <p className="mt-3 text-sm text-[color:var(--foreground)]">{health.service}</p>
          <p className="mt-2 break-all font-mono text-[11px] uppercase tracking-[0.1em] text-[color:var(--muted-foreground)]">
            {health.baseUrl}
          </p>
        </div>
      </div>

      <div className="grid gap-6 p-5 xl:grid-cols-[0.9fr_1.1fr]">
        <div className="space-y-3">
          {items.map((item) => {
            const active = item.id === selectedItem?.id;

            return (
              <button
                key={item.id}
                type="button"
                onClick={() => setSelectedId(item.id)}
                className={`w-full border p-4 text-left transition ${
                  active
                    ? "border-[color:var(--accent)] bg-[color:var(--accent-soft)]"
                    : "border-[color:var(--border)] bg-white/75 hover:bg-[color:var(--muted)]"
                }`}
              >
                <div className="flex items-start justify-between gap-3">
                  <div>
                    <p className="font-mono text-[11px] uppercase tracking-[0.16em] text-[color:var(--muted-foreground)]">
                      {item.sku}
                    </p>
                    <h3 className="mt-2 text-lg font-semibold tracking-[-0.03em] text-[color:var(--foreground)]">
                      {item.itemType}
                    </h3>
                  </div>
                  <span
                    className={`inline-flex items-center border px-2.5 py-1 text-[11px] font-semibold uppercase tracking-[0.16em] ${inventoryTone(item.status)}`}
                  >
                    {inventoryLabel(item.status)}
                  </span>
                </div>
                <dl className="mt-4 grid gap-2 text-sm text-[color:var(--muted-foreground)]">
                  <div className="flex items-center justify-between gap-3">
                    <dt>Available</dt>
                    <dd className="font-medium text-[color:var(--foreground)]">{item.availableUnits}</dd>
                  </div>
                  <div className="flex items-center justify-between gap-3">
                    <dt>In transit</dt>
                    <dd className="font-medium text-[color:var(--foreground)]">{item.inTransitUnits}</dd>
                  </div>
                  <div className="flex items-center justify-between gap-3">
                    <dt>Missing</dt>
                    <dd className="font-medium text-[color:var(--foreground)]">{item.missingUnits}</dd>
                  </div>
                </dl>
              </button>
            );
          })}
        </div>

        {selectedItem && form ? (
          <div className="border border-[color:var(--border)] bg-white/78 p-5">
            <div className="flex flex-wrap items-start justify-between gap-4">
              <div>
                <p className="font-mono text-[11px] uppercase tracking-[0.16em] text-[color:var(--muted-foreground)]">
                  {selectedItem.sku}
                </p>
                <h3 className="mt-2 text-xl font-semibold tracking-[-0.03em] text-[color:var(--foreground)]">
                  {selectedItem.itemType}
                </h3>
              </div>
              <span
                className={`inline-flex items-center border px-2.5 py-1 text-[11px] font-semibold uppercase tracking-[0.16em] ${inventoryTone(selectedItem.status)}`}
              >
                {inventoryLabel(selectedItem.status)}
              </span>
            </div>

            <div className="mt-5 grid gap-4 sm:grid-cols-2">
              {[
                ["totalUnits", "Total units"],
                ["availableUnits", "Available"],
                ["allocatedUnits", "Allocated"],
                ["inTransitUnits", "In transit"],
                ["ingestionUnits", "In ingestion"],
                ["missingUnits", "Missing"],
                ["reorderPoint", "Reorder point"],
              ].map(([field, label]) => (
                <label
                  key={field}
                  className="grid gap-2 text-sm text-[color:var(--muted-foreground)]"
                >
                  {label}
                  <input
                    value={form[field as keyof InventoryFormState]}
                    onChange={(event) =>
                      updateField(field as keyof InventoryFormState, event.target.value)
                    }
                    inputMode="numeric"
                    className="border border-[color:var(--border)] bg-white px-3 py-2.5 text-[color:var(--foreground)] outline-none focus:border-[color:var(--accent)]"
                  />
                </label>
              ))}
            </div>

            <div className="mt-4 grid gap-4 sm:grid-cols-2">
              <label className="grid gap-2 text-sm text-[color:var(--muted-foreground)]">
                Location
                <input
                  value={form.location}
                  onChange={(event) => updateField("location", event.target.value)}
                  className="border border-[color:var(--border)] bg-white px-3 py-2.5 text-[color:var(--foreground)] outline-none focus:border-[color:var(--accent)]"
                />
              </label>
              <label className="grid gap-2 text-sm text-[color:var(--muted-foreground)]">
                Updated by
                <input
                  value={form.updatedBy}
                  onChange={(event) => updateField("updatedBy", event.target.value)}
                  className="border border-[color:var(--border)] bg-white px-3 py-2.5 text-[color:var(--foreground)] outline-none focus:border-[color:var(--accent)]"
                />
              </label>
            </div>

            <label className="mt-4 grid gap-2 text-sm text-[color:var(--muted-foreground)]">
              Admin note
              <textarea
                value={form.note}
                onChange={(event) => updateField("note", event.target.value)}
                rows={4}
                className="border border-[color:var(--border)] bg-white px-3 py-2.5 text-[color:var(--foreground)] outline-none focus:border-[color:var(--accent)]"
              />
            </label>

            <div className="mt-5 flex flex-wrap items-center justify-between gap-4">
              <div className="text-sm text-[color:var(--muted-foreground)]">
                Last change {formatDateTime(selectedItem.updatedAt)} by {selectedItem.updatedBy}
              </div>
              <button
                type="button"
                onClick={() => void handleSave()}
                disabled={saving}
                className="border border-[color:var(--foreground)] bg-[color:var(--foreground)] px-4 py-2.5 text-sm font-semibold text-white transition hover:opacity-90 disabled:cursor-not-allowed disabled:opacity-60"
              >
                {saving ? "Saving..." : "Save Inventory"}
              </button>
            </div>

            {feedback ? (
              <p className="mt-4 text-sm text-[color:var(--muted-foreground)]">{feedback}</p>
            ) : null}
          </div>
        ) : null}
      </div>
    </section>
  );
}
