"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { getQrPackageDetail } from "@/lib/backend";
import type { QrPackageDetail } from "@/lib/operations-types";

/* ─── Token extraction ──────────────────────────────────────────── */
/**
 * The scanner types whatever the QR encodes. We support:
 *   • Full URL  → https://buildai-dlc.vercel.app/qr/qr_abc123
 *   • Short URL → /qr/qr_abc123
 *   • Raw token → qr_abc123
 *   • Package code → PKG-OUT-0041A (we pass as-is and let API handle it)
 */
function extractToken(raw: string): string {
  const trimmed = raw.trim();
  // URL with /qr/ path
  const urlMatch = trimmed.match(/\/qr\/([a-zA-Z0-9_%-]+)/);
  if (urlMatch) return decodeURIComponent(urlMatch[1]);
  // Looks like a raw token (starts with qr_ or similar)
  if (/^[a-zA-Z0-9_-]{4,}$/.test(trimmed)) return trimmed;
  return trimmed;
}

function fmt(v?: string | number | null, fallback = "—") {
  if (v === null || v === undefined || v === "") return fallback;
  return String(v);
}

function fmtDate(s?: string | null) {
  if (!s) return "—";
  try {
    return new Date(s).toLocaleDateString("en-IN", {
      day: "2-digit", month: "short", year: "numeric",
    });
  } catch { return s; }
}

type ScanState = "idle" | "loading" | "found" | "error";

/* ─── Main component ────────────────────────────────────────────── */
export function ScannerStation() {
  const inputRef = useRef<HTMLInputElement>(null);
  const clearTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const [scanState, setScanState] = useState<ScanState>("idle");
  const [rawInput, setRawInput] = useState("");
  const [detail, setDetail] = useState<QrPackageDetail | null>(null);
  const [errorMsg, setErrorMsg] = useState("");
  const [lastToken, setLastToken] = useState("");
  const [scanTime, setScanTime] = useState("");

  // Keep input focused at all times
  useEffect(() => {
    const refocus = () => inputRef.current?.focus();
    refocus();
    document.addEventListener("click", refocus);
    return () => document.removeEventListener("click", refocus);
  }, []);

  const scheduleAutoClear = useCallback((ms = 30_000) => {
    if (clearTimerRef.current) clearTimeout(clearTimerRef.current);
    clearTimerRef.current = setTimeout(() => {
      setScanState("idle");
      setDetail(null);
      setRawInput("");
      setLastToken("");
      setErrorMsg("");
      inputRef.current?.focus();
    }, ms);
  }, []);

  const doLookup = useCallback(async (raw: string) => {
    if (!raw.trim()) return;
    const token = extractToken(raw);
    if (!token) return;

    setLastToken(token);
    setScanState("loading");
    setDetail(null);
    setErrorMsg("");
    setScanTime(new Date().toLocaleTimeString("en-IN", { hour: "2-digit", minute: "2-digit", second: "2-digit" }));

    try {
      const result = await getQrPackageDetail(token);
      if (result) {
        setDetail(result);
        setScanState("found");
        scheduleAutoClear(60_000); // auto-clear after 60s
      } else {
        setErrorMsg(`No package found for: ${token}`);
        setScanState("error");
        scheduleAutoClear(15_000);
      }
    } catch {
      setErrorMsg("Network error — check connection.");
      setScanState("error");
      scheduleAutoClear(15_000);
    }
    setRawInput("");
    inputRef.current?.focus();
  }, [scheduleAutoClear]);

  const handleKeyDown = useCallback((e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key === "Enter") {
      e.preventDefault();
      void doLookup(rawInput);
    }
  }, [rawInput, doLookup]);

  function handleClear() {
    if (clearTimerRef.current) clearTimeout(clearTimerRef.current);
    setScanState("idle");
    setDetail(null);
    setRawInput("");
    setLastToken("");
    setErrorMsg("");
    inputRef.current?.focus();
  }

  const pkg = detail?.package;

  return (
    <div style={{
      minHeight: "100vh", background: "#0f172a", color: "#f1f5f9",
      display: "flex", flexDirection: "column", fontFamily: "'Inter', 'Segoe UI', sans-serif",
    }}>
      {/* ── Header ── */}
      <div style={{
        background: "#1e293b", borderBottom: "1px solid #334155",
        padding: "14px 24px", display: "flex", alignItems: "center", gap: 16,
      }}>
        <div style={{
          width: 36, height: 36, background: "#22c55e", borderRadius: 8,
          display: "flex", alignItems: "center", justifyContent: "center", flexShrink: 0,
        }}>
          <ScannerIcon size={20} color="#fff" />
        </div>
        <div style={{ flex: 1 }}>
          <div style={{ fontSize: 16, fontWeight: 700, color: "#f1f5f9" }}>Build AI — Scanner Station</div>
          <div style={{ fontSize: 12, color: "#94a3b8" }}>Scan a QR code or type a token to look up package details</div>
        </div>
        <StatusPill state={scanState} />
      </div>

      {/* ── Scanner input (hidden but always focused) ── */}
      <input
        ref={inputRef}
        type="text"
        value={rawInput}
        onChange={(e) => setRawInput(e.target.value)}
        onKeyDown={handleKeyDown}
        autoFocus
        style={{
          position: "fixed", top: -999, left: -999,
          opacity: 0, width: 1, height: 1, pointerEvents: "none",
        }}
        aria-label="Scanner input"
      />

      {/* ── Main content ── */}
      <div style={{ flex: 1, display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center", padding: 24 }}>

        {scanState === "idle" && (
          <IdleScreen rawInput={rawInput} onManualSubmit={() => void doLookup(rawInput)} onChangeInput={setRawInput} inputRef={inputRef} />
        )}

        {scanState === "loading" && (
          <div style={{ textAlign: "center" }}>
            <div style={{ fontSize: 64, marginBottom: 16 }}>⏳</div>
            <div style={{ fontSize: 22, fontWeight: 700, color: "#f1f5f9", marginBottom: 8 }}>Looking up package…</div>
            <div style={{ fontSize: 14, color: "#94a3b8", fontFamily: "monospace" }}>{lastToken}</div>
          </div>
        )}

        {scanState === "error" && (
          <div style={{ textAlign: "center", maxWidth: 480 }}>
            <div style={{ fontSize: 64, marginBottom: 16 }}>❌</div>
            <div style={{ fontSize: 22, fontWeight: 700, color: "#f87171", marginBottom: 8 }}>Package Not Found</div>
            <div style={{ fontSize: 14, color: "#94a3b8", fontFamily: "monospace", marginBottom: 20 }}>{errorMsg}</div>
            <button onClick={handleClear} style={btnStyle("#334155", "#f1f5f9")}>Scan Again</button>
          </div>
        )}

        {scanState === "found" && detail && pkg && (
          <PackageResult detail={detail} onClear={handleClear} scanTime={scanTime} />
        )}
      </div>

      {/* ── Footer tip ── */}
      <div style={{
        background: "#1e293b", borderTop: "1px solid #334155",
        padding: "10px 24px", display: "flex", alignItems: "center", justifyContent: "space-between",
      }}>
        <div style={{ fontSize: 12, color: "#64748b" }}>
          Point scanner at QR code — or type token &amp; press Enter
        </div>
        <a href="/qr-help" style={{ fontSize: 12, color: "#64748b" }}>
          Also works at <span style={{ color: "#38bdf8" }}>buildai-dlc.vercel.app/qr/[token]</span> on mobile
        </a>
      </div>
    </div>
  );
}

/* ─── Idle Screen ─────────────────────────────────────────── */
function IdleScreen({
  rawInput, onManualSubmit, onChangeInput, inputRef,
}: {
  rawInput: string;
  onManualSubmit: () => void;
  onChangeInput: (v: string) => void;
  inputRef: React.RefObject<HTMLInputElement | null>;
}) {
  const visibleRef = useRef<HTMLInputElement>(null);
  return (
    <div style={{ textAlign: "center", maxWidth: 560, width: "100%" }}>
      {/* Big scanner graphic */}
      <div style={{ marginBottom: 24 }}>
        <div style={{
          width: 100, height: 100, borderRadius: "50%", background: "#1e293b",
          border: "3px solid #22c55e", display: "flex", alignItems: "center",
          justifyContent: "center", margin: "0 auto 16px",
          boxShadow: "0 0 0 8px rgba(34,197,94,0.12)",
        }}>
          <ScannerIcon size={44} color="#22c55e" />
        </div>
        <div style={{ fontSize: 24, fontWeight: 800, color: "#f1f5f9", marginBottom: 8 }}>
          Ready to Scan
        </div>
        <div style={{ fontSize: 14, color: "#94a3b8" }}>
          Point the scanner at a QR code on any package label
        </div>
      </div>

      {/* Manual type input (visible) */}
      <div style={{ display: "flex", gap: 8, marginTop: 24 }}>
        <input
          ref={visibleRef}
          type="text"
          value={rawInput}
          placeholder="Or type / paste a token or URL here…"
          onChange={(e) => onChangeInput(e.target.value)}
          onKeyDown={(e) => { if (e.key === "Enter") { e.preventDefault(); onManualSubmit(); } }}
          onFocus={() => { /* keep this focused instead of hidden */ }}
          style={{
            flex: 1, padding: "12px 16px", background: "#1e293b", border: "1px solid #334155",
            color: "#f1f5f9", fontSize: 14, outline: "none", borderRadius: 4,
            fontFamily: "monospace",
          }}
        />
        <button
          onClick={onManualSubmit}
          disabled={!rawInput.trim()}
          style={btnStyle("#22c55e", "#0f172a", !rawInput.trim())}
        >
          Search
        </button>
      </div>

      {/* Supported formats hint */}
      <div style={{ marginTop: 20, display: "flex", flexDirection: "column", gap: 4 }}>
        {[
          ["URL", "https://buildai-dlc.vercel.app/qr/qr_abc123"],
          ["Token", "qr_abc123def456"],
          ["Package code", "PKG-OUT-0041A"],
        ].map(([label, example]) => (
          <div key={label} style={{ display: "flex", gap: 8, fontSize: 11, color: "#64748b", textAlign: "left" }}>
            <span style={{ minWidth: 90, color: "#475569", fontWeight: 600 }}>{label}</span>
            <span style={{ fontFamily: "monospace" }}>{example}</span>
          </div>
        ))}
      </div>
    </div>
  );
}

/* ─── Package Result ──────────────────────────────────────── */
function PackageResult({
  detail, onClear, scanTime,
}: {
  detail: QrPackageDetail;
  onClear: () => void;
  scanTime: string;
}) {
  const pkg = detail.package;
  const statusColor: Record<string, string> = {
    accepted: "#22c55e", outbound_shipped: "#3b82f6", factory_received: "#8b5cf6",
    return_shipped: "#f59e0b", hq_received: "#0ea5e9",
    transferred_to_ingestion: "#a855f7", ingestion_processing: "#f97316",
    ingestion_completed: "#22c55e", closed: "#6b7280",
  };
  const color = statusColor[pkg.status] ?? "#94a3b8";

  return (
    <div style={{ width: "100%", maxWidth: 680 }}>
      {/* Success header */}
      <div style={{
        background: "#052e16", border: "1px solid #16a34a", borderRadius: 8,
        padding: "14px 20px", marginBottom: 16, display: "flex", alignItems: "center", gap: 12,
      }}>
        <div style={{ fontSize: 28 }}>✅</div>
        <div style={{ flex: 1 }}>
          <div style={{ fontSize: 18, fontWeight: 800, color: "#4ade80" }}>Package Found</div>
          <div style={{ fontSize: 12, color: "#86efac" }}>Scanned at {scanTime}</div>
        </div>
        <button onClick={onClear} style={btnStyle("#1e293b", "#94a3b8")}>Clear</button>
      </div>

      {/* Package card */}
      <div style={{
        background: "#1e293b", border: "1px solid #334155", borderRadius: 8,
        overflow: "hidden",
      }}>
        {/* Package code banner */}
        <div style={{
          background: "#0f172a", padding: "14px 20px", borderBottom: "1px solid #334155",
          display: "flex", alignItems: "center", justifyContent: "space-between",
        }}>
          <div>
            <div style={{ fontSize: 11, color: "#64748b", textTransform: "uppercase", letterSpacing: "0.08em", marginBottom: 2 }}>
              Package Code
            </div>
            <div style={{ fontSize: 24, fontWeight: 800, color: "#f1f5f9", fontFamily: "monospace" }}>
              {fmt(pkg.packageCode)}
            </div>
          </div>
          <div style={{
            padding: "6px 14px", background: `${color}22`, border: `1px solid ${color}`,
            borderRadius: 20, fontSize: 13, fontWeight: 700, color,
            textTransform: "uppercase", letterSpacing: "0.04em",
          }}>
            {pkg.status.replace(/_/g, " ")}
          </div>
        </div>

        {/* Detail grid */}
        <div style={{
          display: "grid", gridTemplateColumns: "1fr 1fr",
          gap: 0,
        }}>
          {[
            ["Ticket", detail.title ?? "—"],
            ["Team", fmt(detail.teamName)],
            ["Factory", fmt(detail.factoryName)],
            ["Deployment Date", fmtDate(detail.deploymentDate)],
            ["Direction", pkg.direction === "outbound" ? "📦 Outbound (to factory)" : "🔄 Return (to HQ)"],
            ["Item Count", fmt(pkg.itemCount)],
            ["Shipped Devices", fmt(pkg.shippedDevicesCount, "0")],
            ["Shipped SD Cards", fmt(pkg.shippedSdCardsCount, "0")],
            pkg.receivedDevicesCount != null ? ["Received Devices", fmt(pkg.receivedDevicesCount)] : null,
            pkg.receivedSdCardsCount != null ? ["Received SD Cards", fmt(pkg.receivedSdCardsCount)] : null,
            pkg.note ? ["Note", fmt(pkg.note)] : null,
            pkg.updatedBy ? ["Last Updated By", fmt(pkg.updatedBy)] : null,
          ].filter(Boolean).map((row, i) => {
            const [label, value] = row as [string, string];
            return (
              <div key={i} style={{
                padding: "12px 20px", borderBottom: "1px solid #1e293b",
                borderRight: i % 2 === 0 ? "1px solid #334155" : "none",
                background: i % 4 < 2 ? "#1e293b" : "#172032",
              }}>
                <div style={{ fontSize: 10, color: "#64748b", textTransform: "uppercase", letterSpacing: "0.06em", marginBottom: 3 }}>
                  {label}
                </div>
                <div style={{ fontSize: 15, fontWeight: 600, color: "#e2e8f0", wordBreak: "break-word" }}>
                  {value}
                </div>
              </div>
            );
          })}
        </div>

        {/* QR token footer */}
        <div style={{
          padding: "10px 20px", background: "#0f172a", borderTop: "1px solid #334155",
          display: "flex", alignItems: "center", gap: 8,
        }}>
          <span style={{ fontSize: 10, color: "#475569", textTransform: "uppercase", letterSpacing: "0.06em" }}>Token</span>
          <span style={{ fontSize: 12, color: "#64748b", fontFamily: "monospace" }}>{pkg.qrToken}</span>
          <span style={{ marginLeft: "auto", fontSize: 11, color: "#475569" }}>
            Auto-clears in 60s — scan another to replace
          </span>
        </div>
      </div>

      {/* Scan again */}
      <div style={{ marginTop: 16, textAlign: "center" }}>
        <button onClick={onClear} style={btnStyle("#22c55e", "#0f172a")}>
          ↩ Scan Next Package
        </button>
      </div>
    </div>
  );
}

/* ─── Status pill ─────────────────────────────────────────── */
function StatusPill({ state }: { state: ScanState }) {
  const map: Record<ScanState, [string, string, string]> = {
    idle:    ["#22c55e22", "#4ade80", "● Ready"],
    loading: ["#f59e0b22", "#fbbf24", "◌ Scanning…"],
    found:   ["#22c55e22", "#4ade80", "✓ Found"],
    error:   ["#ef444422", "#f87171", "✗ Not found"],
  };
  const [bg, color, label] = map[state];
  return (
    <div style={{
      padding: "5px 14px", background: bg, border: `1px solid ${color}`,
      borderRadius: 20, fontSize: 12, fontWeight: 700, color,
    }}>
      {label}
    </div>
  );
}

/* ─── Scanner icon SVG ────────────────────────────────────── */
function ScannerIcon({ size = 24, color = "currentColor" }: { size?: number; color?: string }) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke={color} strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <path d="M3 7V5a2 2 0 012-2h2" />
      <path d="M17 3h2a2 2 0 012 2v2" />
      <path d="M21 17v2a2 2 0 01-2 2h-2" />
      <path d="M7 21H5a2 2 0 01-2-2v-2" />
      <line x1="7" y1="12" x2="17" y2="12" />
      <line x1="7" y1="8" x2="7" y2="16" />
      <line x1="11" y1="8" x2="11" y2="16" />
      <line x1="15" y1="8" x2="15" y2="16" />
      <line x1="17" y1="8" x2="17" y2="16" />
    </svg>
  );
}

/* ─── Button style helper ─────────────────────────────────── */
function btnStyle(bg: string, color: string, disabled = false): React.CSSProperties {
  return {
    padding: "10px 22px", background: disabled ? "#1e293b" : bg,
    color: disabled ? "#475569" : color, border: "none",
    fontSize: 14, fontWeight: 700, cursor: disabled ? "not-allowed" : "pointer",
    borderRadius: 4, transition: "opacity 0.15s",
    opacity: disabled ? 0.5 : 1,
  };
}
