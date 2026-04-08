"use client";

import { useMemo, useState } from "react";
import type { AuthSession, DashboardSnapshot, TicketRecord } from "@/lib/operations-types";
import { LiveIndiaMap } from "@/components/live/live-india-map";

type Props = {
  snapshot: DashboardSnapshot;
  session: AuthSession;
};

function ticketInLiveView(t: TicketRecord): boolean {
  if (t.status === "rejected") return false;
  if (
    t.liveDevicesShipped != null ||
    t.factoryMapAddress ||
    (typeof t.factoryLatitude === "number" && typeof t.factoryLongitude === "number")
  ) {
    return true;
  }
  return (
    t.status !== "open" &&
    t.status !== "accepted" &&
    t.status !== "closed"
  );
}

export function LiveWorkspace({ snapshot, session }: Props) {
  void session;
  const [selectedId, setSelectedId] = useState<string | null>(null);

  const liveTickets = useMemo(
    () => snapshot.tickets.filter(ticketInLiveView).sort((a, b) => b.deploymentDate.localeCompare(a.deploymentDate)),
    [snapshot.tickets],
  );

  const selected = useMemo(
    () => liveTickets.find((t) => t.id === selectedId) ?? null,
    [liveTickets, selectedId],
  );

  return (
    <div style={{ display: "flex", flexDirection: "column", height: "100%", overflow: "hidden" }}>
      <header
        style={{
          padding: "16px 20px",
          borderBottom: "1px solid var(--border)",
          background: "var(--bg)",
          flexShrink: 0,
        }}
      >
        <h1 style={{ fontSize: 20, fontWeight: 800, letterSpacing: "-0.03em", marginBottom: 4 }}>Live</h1>
        <p style={{ fontSize: 13, color: "var(--text-secondary)", maxWidth: 720 }}>
          India map of active factory sites. Pins appear after logistics ships hardware and enters a full street
          address (geocoded in India). Utilization is updated from the ticket when logistics confirms counts with the
          factory.
        </p>
      </header>

      <div style={{ flex: 1, display: "flex", minHeight: 0 }}>
        <aside
          style={{
            width: "min(320px, 38vw)",
            borderRight: "1px solid var(--border)",
            overflowY: "auto",
            background: "var(--bg)",
            flexShrink: 0,
          }}
        >
          {liveTickets.length === 0 ? (
            <div style={{ padding: 20, fontSize: 13, color: "var(--text-muted)" }}>
              No deployments on the map yet. When logistics uses <strong>Ship to Factory</strong> and enters the factory
              address, a pin will appear here after the shipment is confirmed.
            </div>
          ) : (
            liveTickets.map((t) => {
              const hasPin = typeof t.factoryLatitude === "number" && typeof t.factoryLongitude === "number";
              const eff =
                t.liveDevicesShipped && t.liveDevicesShipped > 0 && t.liveDevicesDeployed != null
                  ? Math.min(100, Math.round((t.liveDevicesDeployed / t.liveDevicesShipped) * 100))
                  : null;
              return (
                <button
                  key={t.id}
                  type="button"
                  onClick={() => setSelectedId(t.id)}
                  style={{
                    display: "block",
                    width: "100%",
                    textAlign: "left",
                    padding: "12px 14px",
                    border: "none",
                    borderBottom: "1px solid var(--border)",
                    background: selected?.id === t.id ? "var(--bg-subtle)" : "transparent",
                    cursor: "pointer",
                    fontFamily: "var(--font-ui)",
                  }}
                >
                  <div style={{ fontWeight: 700, fontSize: 13 }}>{t.factoryName}</div>
                  <div style={{ fontSize: 11, color: "var(--text-muted)", marginTop: 2 }}>{t.teamName}</div>
                  <div style={{ fontSize: 10, fontFamily: "var(--font-mono)", marginTop: 6, color: "var(--text-secondary)" }}>
                    {hasPin ? "📍 On map" : "⚠ No pin — add address on next ship"}
                    {eff != null && ` · ${eff}% util.`}
                  </div>
                </button>
              );
            })
          )}
        </aside>

        <div style={{ flex: 1, minWidth: 0, display: "flex", flexDirection: "column", padding: 12, gap: 10 }}>
          <div style={{ flex: 1, minHeight: 240 }}>
            <LiveIndiaMap tickets={liveTickets} />
          </div>
          {selected && (
            <div
              style={{
                flexShrink: 0,
                padding: 14,
                border: "1px solid var(--border)",
                background: "var(--bg)",
                borderRadius: 4,
                fontSize: 12,
              }}
            >
              <div style={{ fontWeight: 700, marginBottom: 8 }}>{selected.title}</div>
              <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(140px, 1fr))", gap: 8, fontFamily: "var(--font-mono)", fontSize: 11 }}>
                <div>Shipped dev. <strong>{selected.liveDevicesShipped ?? "—"}</strong></div>
                <div>Shipped SD <strong>{selected.liveSdCardsShipped ?? "—"}</strong></div>
                <div>Deployed dev. <strong>{selected.liveDevicesDeployed ?? "—"}</strong></div>
                <div>SD in use <strong>{selected.liveSdCardsInUse ?? "—"}</strong></div>
              </div>
              {selected.liveUtilizationNote && (
                <div style={{ marginTop: 8, color: "var(--text-secondary)" }}>Note: {selected.liveUtilizationNote}</div>
              )}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
