"use client";

import { useEffect, useMemo } from "react";
import { MapContainer, TileLayer, Marker, Popup, useMap } from "react-leaflet";
import L from "leaflet";
import "leaflet/dist/leaflet.css";
import type { TicketRecord } from "@/lib/operations-types";

const INDIA_CENTER: [number, number] = [22.5, 79.0];
const INDIA_BOUNDS: L.LatLngBoundsExpression = [
  [6.35, 67.95],
  [37.55, 97.6],
];

const pinIcon = L.divIcon({
  className: "live-map-pin",
  html: '<div class="live-map-pin-inner"></div>',
  iconSize: [16, 16],
  iconAnchor: [8, 8],
});

function FitBounds({ tickets }: { tickets: TicketRecord[] }) {
  const map = useMap();
  useEffect(() => {
    const withCoords = tickets.filter(
      (t) => typeof t.factoryLatitude === "number" && typeof t.factoryLongitude === "number",
    );
    if (withCoords.length === 0) {
      map.fitBounds(INDIA_BOUNDS, { padding: [28, 28] });
      return;
    }
    const b = L.latLngBounds(
      withCoords.map(
        (t) => [t.factoryLatitude as number, t.factoryLongitude as number] as L.LatLngExpression,
      ),
    );
    map.fitBounds(b, { padding: [56, 56], maxZoom: 10 });
  }, [map, tickets]);
  return null;
}

function effPct(deployed: number | null | undefined, shipped: number | null | undefined): string {
  const s = shipped ?? 0;
  const d = deployed ?? 0;
  if (s <= 0) return "—";
  return `${Math.min(100, Math.round((d / s) * 100))}%`;
}

export function LiveIndiaMap({ tickets }: { tickets: TicketRecord[] }) {
  const markers = useMemo(
    () =>
      tickets.filter(
        (t) => typeof t.factoryLatitude === "number" && typeof t.factoryLongitude === "number",
      ),
    [tickets],
  );

  return (
    <div
      className="live-map-grayscale"
      style={{ height: "100%", width: "100%", minHeight: 280, borderRadius: 4, overflow: "hidden", border: "1px solid var(--border)" }}
    >
      <MapContainer
        center={INDIA_CENTER}
        zoom={5}
        minZoom={4}
        maxBounds={INDIA_BOUNDS}
        maxBoundsViscosity={0.9}
        style={{ height: "100%", width: "100%" }}
        scrollWheelZoom
      >
        <TileLayer
          attribution='&copy; OpenStreetMap &copy; CARTO'
          url="https://{s}.basemaps.cartocdn.com/light_all/{z}/{x}/{y}{r}.png"
          subdomains="abcd"
        />
        <FitBounds tickets={tickets} />
        {markers.map((t) => (
          <Marker
            key={t.id}
            position={[t.factoryLatitude as number, t.factoryLongitude as number]}
            icon={pinIcon}
          >
            <Popup className="live-map-popup" maxWidth={280}>
              <div style={{ fontFamily: "var(--font-ui)", fontSize: 12, lineHeight: 1.45, minWidth: 200 }}>
                <div style={{ fontWeight: 700, fontSize: 13, marginBottom: 6 }}>{t.factoryName}</div>
                <div style={{ color: "var(--text-secondary)", marginBottom: 8 }}>{t.teamName}</div>
                {t.factoryMapAddress && (
                  <div style={{ fontSize: 11, color: "var(--text-muted)", marginBottom: 8 }}>{t.factoryMapAddress}</div>
                )}
                <div style={{ display: "grid", gap: 4, fontFamily: "var(--font-mono)", fontSize: 11 }}>
                  <div>Shipped: devices <strong>{t.liveDevicesShipped ?? "—"}</strong> · SD <strong>{t.liveSdCardsShipped ?? "—"}</strong></div>
                  <div>Deployed / in use: devices <strong>{t.liveDevicesDeployed ?? "—"}</strong> · SD <strong>{t.liveSdCardsInUse ?? "—"}</strong></div>
                  <div>Efficiency (devices): <strong>{effPct(t.liveDevicesDeployed, t.liveDevicesShipped)}</strong></div>
                  {(t.liveReturnedDevicesEstimate != null || t.liveReturnedSdCardsEstimate != null) && (
                    <div>
                      Return est.: devices <strong>{t.liveReturnedDevicesEstimate ?? "—"}</strong> · SD{" "}
                      <strong>{t.liveReturnedSdCardsEstimate ?? "—"}</strong>
                    </div>
                  )}
                  <div style={{ color: "var(--text-muted)", textTransform: "uppercase", letterSpacing: "0.06em", marginTop: 4 }}>
                    {t.status.replace(/_/g, " ")}
                  </div>
                </div>
              </div>
            </Popup>
          </Marker>
        ))}
      </MapContainer>
    </div>
  );
}
