"use client";

import type { AuthSession, DashboardSnapshot } from "@/lib/operations-types";

type Props = {
  snapshot: DashboardSnapshot;
  session: AuthSession;
};

function scoreColor(score: number) {
  if (score >= 90) return "var(--text-primary)";
  if (score >= 70) return "var(--text-secondary)";
  return "var(--error)";
}

function scoreBar(score: number) {
  return (
    <div style={{ height: 6, background: "var(--bg-muted)", border: "1px solid var(--border)", width: "100%" }}>
      <div style={{
        height: "100%", width: `${score}%`,
        background: score >= 90 ? "var(--text-primary)" : score >= 70 ? "#888" : "var(--error)",
        transition: "width 0.3s",
      }} />
    </div>
  );
}

export function MeritWorkspace({ snapshot, session }: Props) {
  const scores = [...(snapshot.meritScores ?? [])].sort((a, b) => a.score - b.score);
  const role = session.user.role;

  void role;

  const avgScore = scores.length > 0
    ? Math.round(scores.reduce((s, m) => s + m.score, 0) / scores.length)
    : 0;

  const atRisk = scores.filter((m) => m.score < 70).length;

  return (
    <div style={{ height: "100%", display: "flex", flexDirection: "column", overflow: "hidden" }}>
      {/* Header */}
      <div className="workspace-header">
        <div style={{ fontSize: 13, fontWeight: 700 }}>Merit Scores</div>
        <div style={{ marginLeft: "auto", display: "flex", gap: 16, fontSize: 11, color: "var(--text-muted)" }}>
          <span>Avg: <strong style={{ color: scoreColor(avgScore), fontFamily: "var(--font-mono)" }}>{avgScore}</strong></span>
          {atRisk > 0 && <span style={{ color: "var(--error)", fontWeight: 700 }}>⚠ {atRisk} team{atRisk > 1 ? "s" : ""} at risk</span>}
        </div>
      </div>

      <div style={{ flex: 1, overflowY: "auto", padding: 20 }}>
        <div style={{ marginBottom: 16, fontSize: 12, color: "var(--text-muted)", lineHeight: 1.6 }}>
          Merit scores measure how responsibly teams return deployment equipment.{" "}
          <strong style={{ color: "var(--text-secondary)" }}>50%</strong> SD card returns ·{" "}
          <strong style={{ color: "var(--text-secondary)" }}>25%</strong> device returns ·{" "}
          <strong style={{ color: "var(--text-secondary)" }}>25%</strong> accessories
        </div>

        {scores.length === 0 ? (
          <div className="empty-state">
            <div className="empty-state-icon">◈</div>
            <div className="empty-state-title">No merit data yet</div>
            <div className="empty-state-desc">Merit scores are calculated from completed ticket return cycles.</div>
          </div>
        ) : (
          <>
            {/* Summary strip */}
            <div className="metric-grid" style={{ marginBottom: 20 }}>
              <div className="metric-cell">
                <div className="metric-value">{scores.length}</div>
                <div className="metric-label">Teams Tracked</div>
              </div>
              <div className="metric-cell">
                <div className="metric-value" style={{ color: scoreColor(avgScore) }}>{avgScore}</div>
                <div className="metric-label">Average Score</div>
              </div>
              <div className="metric-cell">
                <div className="metric-value">{scores.filter((m) => m.score >= 90).length}</div>
                <div className="metric-label">Excellent (90+)</div>
              </div>
              <div className="metric-cell">
                <div className="metric-value" style={{ color: atRisk > 0 ? "var(--error)" : undefined }}>{atRisk}</div>
                <div className="metric-label">At Risk (&lt;70)</div>
              </div>
            </div>

            {/* Score table */}
            <div className="panel">
              <div className="panel-header">
                <span className="panel-title">Team Rankings</span>
                <span style={{ fontSize: 10, color: "var(--text-muted)" }}>Sorted by score (lowest first)</span>
              </div>
              <div className="data-table-wrap">
              <table className="data-table" style={{ minWidth: 520 }}>
                <thead>
                  <tr>
                    <th>Team</th>
                    <th>Score</th>
                    <th>Progress</th>
                    <th>SD Shortfall</th>
                    <th>Device Shortfall</th>
                    <th>Accessory Shortfall</th>
                    <th>Status</th>
                  </tr>
                </thead>
                <tbody>
                  {scores.map((m) => (
                    <tr key={m.teamName}>
                      <td style={{ fontWeight: 600, fontSize: 13 }}>{m.teamName}</td>
                      <td>
                        <span className="mono" style={{ fontSize: 18, fontWeight: 800, color: scoreColor(m.score) }}>
                          {m.score}
                        </span>
                      </td>
                      <td style={{ minWidth: 120 }}>
                        {scoreBar(m.score)}
                      </td>
                      <td className="mono" style={{ color: m.sdCardShortfall > 0 ? "var(--error)" : "var(--text-muted)" }}>
                        {m.sdCardShortfall > 0 ? `-${m.sdCardShortfall}` : "—"}
                      </td>
                      <td className="mono" style={{ color: m.deviceShortfall > 0 ? "var(--error)" : "var(--text-muted)" }}>
                        {m.deviceShortfall > 0 ? `-${m.deviceShortfall}` : "—"}
                      </td>
                      <td className="mono" style={{ color: m.accessoryShortfall > 0 ? "var(--error)" : "var(--text-muted)" }}>
                        {m.accessoryShortfall > 0 ? `-${m.accessoryShortfall}` : "—"}
                      </td>
                      <td>
                        {m.score >= 90
                          ? <span className="badge badge-accepted">Excellent</span>
                          : m.score >= 70
                            ? <span className="badge badge-outbound_shipped">Good</span>
                            : <span className="badge badge-rejected">Risk</span>}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
              </div>
            </div>

            {/* Legend */}
            <div style={{ marginTop: 16, display: "flex", gap: 20, fontSize: 11, color: "var(--text-muted)" }}>
              <span>
                <span className="mono" style={{ fontWeight: 700, color: "var(--text-primary)" }}>90–100</span> — Excellent
              </span>
              <span>
                <span className="mono" style={{ fontWeight: 700, color: "var(--text-secondary)" }}>70–89</span> — Good
              </span>
              <span>
                <span className="mono" style={{ fontWeight: 700, color: "var(--error)" }}>&lt;70</span> — At Risk
              </span>
            </div>
          </>
        )}
      </div>
    </div>
  );
}
