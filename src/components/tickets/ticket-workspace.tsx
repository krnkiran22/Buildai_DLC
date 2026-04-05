"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { CreateTicketModal } from "@/components/tickets/create-ticket-modal";
import { TicketChatPanel } from "@/components/tickets/ticket-chat-panel";
import { TicketDetailPanel } from "@/components/tickets/ticket-detail-panel";
import { TicketListPanel } from "@/components/tickets/ticket-list-panel";
import { listTickets } from "@/lib/backend";
import type { AuthSession, DashboardSnapshot, TicketRecord } from "@/lib/operations-types";

const POLL_INTERVAL_MS = 30_000; // refresh ticket list every 30 seconds

type MobileView = "list" | "chat" | "detail";

// View depth: higher = further into the stack (determines slide direction)
const VIEW_DEPTH: Record<MobileView, number> = { list: 0, chat: 1, detail: 2 };

type Props = {
  snapshot: DashboardSnapshot;
  session: AuthSession;
  onSessionChange: (s: AuthSession | null) => void;
};

export function TicketWorkspace({ snapshot, session, onSessionChange }: Props) {
  const [tickets, setTickets] = useState<TicketRecord[]>(snapshot.tickets ?? []);
  const [selectedId, setSelectedId] = useState<string | null>(
    snapshot.highlightedTicketId || tickets[0]?.id || null,
  );
  const [showCreateModal, setShowCreateModal] = useState(false);
  const [mobileView, setMobileView] = useState<MobileView>("list");
  const [isMobile, setIsMobile] = useState(false);
  const [slideDir, setSlideDir] = useState<"right" | "left">("right");
  const prevViewRef = useRef<MobileView>("list");

  useEffect(() => {
    const check = () => setIsMobile(window.innerWidth <= 768);
    check();
    window.addEventListener("resize", check);
    return () => window.removeEventListener("resize", check);
  }, []);

  // Poll the ticket list every 30 s so all roles (logistics, admin, etc.)
  // see new tickets without a manual page refresh.
  useEffect(() => {
    const poll = async () => {
      try {
        const fresh = await listTickets(session);
        if (fresh) {
          setTickets((prev) => {
            // Merge: keep any optimistic local-only tickets, update the rest
            const freshMap = new Map(fresh.map((t) => [t.id, t]));
            const merged = prev.map((t) => freshMap.get(t.id) ?? t);
            const existingIds = new Set(prev.map((t) => t.id));
            const newOnes = fresh.filter((t) => !existingIds.has(t.id));
            return [...newOnes, ...merged];
          });
        }
      } catch {
        // Silent — don't disrupt the UI on poll failure
      }
    };
    const id = setInterval(() => { void poll(); }, POLL_INTERVAL_MS);
    return () => clearInterval(id);
  }, [session]);

  const selectedTicket = tickets.find((t) => t.id === selectedId) ?? null;

  const handleTicketUpdated = useCallback((updated: TicketRecord) => {
    setTickets((prev) => {
      const idx = prev.findIndex((t) => t.id === updated.id);
      if (idx >= 0) {
        const next = [...prev];
        next[idx] = updated;
        return next;
      }
      return [updated, ...prev];
    });
  }, []);

  const handleTicketCreated = useCallback((ticket: TicketRecord) => {
    setTickets((prev) => [ticket, ...prev]);
    setSelectedId(ticket.id);
    setShowCreateModal(false);
    if (isMobile) navigateTo("chat");
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isMobile]);

  function navigateTo(view: MobileView) {
    const isForward = VIEW_DEPTH[view] > VIEW_DEPTH[prevViewRef.current];
    setSlideDir(isForward ? "right" : "left");
    prevViewRef.current = view;
    setMobileView(view);
  }

  function handleSelectTicket(id: string) {
    setSelectedId(id);
    if (isMobile) navigateTo("chat");
  }

  // ── Mobile ─────────────────────────────────────────────────
  if (isMobile) {
    const canShowChat = !!selectedTicket;
    const animClass = slideDir === "right" ? "anim-slide-right" : "anim-slide-left";

    return (
      <div style={{ height: "100%", display: "flex", flexDirection: "column", overflow: "hidden", background: "var(--bg)" }}>

        {/* ── Ticket header bar (when inside a ticket) ── */}
        {mobileView !== "list" && selectedTicket && (
          <div style={{
            padding: "0 14px",
            height: 52,
            background: "rgba(255,255,255,0.92)",
            backdropFilter: "blur(20px)",
            WebkitBackdropFilter: "blur(20px)",
            borderBottom: "1px solid rgba(0,0,0,0.06)",
            flexShrink: 0,
            display: "flex",
            alignItems: "center",
            gap: 12,
            zIndex: 10,
          }}>
            <button
              onClick={() => navigateTo(mobileView === "detail" ? "chat" : "list")}
              style={{
                background: "none", border: "none", fontSize: 24, lineHeight: 1,
                cursor: "pointer", color: "var(--text-primary)", padding: "4px",
                display: "flex", alignItems: "center", flexShrink: 0,
                WebkitTapHighlightColor: "transparent",
              }}
              aria-label="Back"
            >
              ‹
            </button>
            <div style={{ flex: 1, minWidth: 0 }}>
              <div style={{
                fontSize: 15, fontWeight: 700, color: "var(--text-primary)",
                overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap",
              }}>
                {selectedTicket.teamName}
              </div>
              <div style={{
                fontSize: 11, color: "var(--text-muted)",
                overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap",
              }}>
                {selectedTicket.factoryName} · {selectedTicket.status.replace(/_/g, " ")}
              </div>
            </div>
          </div>
        )}

        {/* ── Animated pane container ── */}
        <div style={{ flex: 1, overflow: "hidden", position: "relative" }}>
          <div
            key={`${mobileView}-${selectedId}`}
            className={animClass}
            style={{
              position: "absolute", inset: 0,
              display: "flex", flexDirection: "column",
              background: "var(--bg)",
              willChange: "transform",
            }}
          >
            {mobileView === "list" && (
              <TicketListPanel
                tickets={tickets}
                selectedId={selectedId}
                session={session}
                onSelect={handleSelectTicket}
                onCreateNew={() => setShowCreateModal(true)}
              />
            )}

            {mobileView === "chat" && selectedTicket && (
              <TicketChatPanel
                ticket={selectedTicket}
                session={session}
                onTicketUpdated={handleTicketUpdated}
              />
            )}

            {mobileView === "chat" && !selectedTicket && (
              <div className="empty-state anim-fade" style={{ flex: 1 }}>
                <div style={{ fontSize: 32 }}>💬</div>
                <div className="empty-state-title" style={{ marginTop: 12 }}>No ticket selected</div>
                <div className="empty-state-desc">Go back and pick a ticket.</div>
              </div>
            )}

            {mobileView === "detail" && selectedTicket && (
              <TicketDetailPanel
                ticket={selectedTicket}
                session={session}
                onTicketUpdated={handleTicketUpdated}
              />
            )}
          </div>
        </div>

        {/* ── Bottom tab bar ── */}
        <div style={{
          display: "flex",
          borderTop: "1px solid rgba(0,0,0,0.07)",
          background: "rgba(255,255,255,0.95)",
          backdropFilter: "blur(20px)",
          WebkitBackdropFilter: "blur(20px)",
          flexShrink: 0,
          paddingBottom: "env(safe-area-inset-bottom, 0px)",
          zIndex: 20,
        }}>
          {([
            { v: "list" as MobileView, icon: "☰", label: "Tickets", always: true },
            { v: "chat" as MobileView, icon: "💬", label: "Chat",    always: false },
            { v: "detail" as MobileView, icon: "ℹ", label: "Info",  always: false },
          ]).map(({ v, icon, label, always }) => {
            const active = mobileView === v;
            const disabled = !always && !canShowChat;
            return (
              <button
                key={v}
                onClick={() => { if (!disabled) navigateTo(v); }}
                style={{
                  flex: 1,
                  padding: "9px 4px 8px",
                  border: "none",
                  background: "none",
                  cursor: disabled ? "not-allowed" : "pointer",
                  display: "flex", flexDirection: "column", alignItems: "center", gap: 3,
                  opacity: disabled ? 0.3 : 1,
                  transition: "opacity 0.15s var(--ease-out)",
                  WebkitTapHighlightColor: "transparent",
                  position: "relative",
                }}
              >
                {/* Active indicator bar */}
                <div style={{
                  position: "absolute", top: 0, left: "25%", right: "25%",
                  height: 2,
                  background: active ? "var(--action)" : "transparent",
                  borderRadius: "0 0 2px 2px",
                  transition: "background 0.2s var(--ease-out)",
                }} />
                <span style={{
                  fontSize: 20, lineHeight: 1,
                  transform: active ? "scale(1.1)" : "scale(1)",
                  transition: "transform 0.2s var(--ease-spring)",
                  display: "block",
                }}>{icon}</span>
                <span style={{
                  fontSize: 10,
                  fontWeight: active ? 700 : 400,
                  color: active ? "var(--text-primary)" : "var(--text-muted)",
                  textTransform: "uppercase",
                  letterSpacing: "0.04em",
                  fontFamily: "var(--font-mono)",
                  transition: "color 0.15s, font-weight 0.15s",
                }}>
                  {label}
                </span>
              </button>
            );
          })}
        </div>

        {showCreateModal && (
          <CreateTicketModal
            session={session}
            onCreated={handleTicketCreated}
            onClose={() => setShowCreateModal(false)}
          />
        )}
      </div>
    );
  }

  // ── Desktop: three-pane ────────────────────────────────────
  return (
    <div style={{ display: "flex", height: "100%", overflow: "hidden" }}>
      <TicketListPanel
        tickets={tickets}
        selectedId={selectedId}
        session={session}
        onSelect={setSelectedId}
        onCreateNew={() => setShowCreateModal(true)}
      />

      {selectedTicket ? (
        <TicketChatPanel
          ticket={selectedTicket}
          session={session}
          onTicketUpdated={handleTicketUpdated}
        />
      ) : (
        <div style={{
          flex: 1, display: "flex", alignItems: "center", justifyContent: "center",
          borderRight: "1px solid var(--border)", background: "var(--bg)",
        }}>
          <div className="empty-state anim-scale">
            <div className="empty-state-icon">◫</div>
            <div className="empty-state-title">No ticket selected</div>
            <div className="empty-state-desc">
              Select a ticket from the list to view the conversation.
            </div>
          </div>
        </div>
      )}

      {selectedTicket ? (
        <TicketDetailPanel
          ticket={selectedTicket}
          session={session}
          onTicketUpdated={handleTicketUpdated}
        />
      ) : (
        <div style={{
          width: 300, minWidth: 300, background: "var(--bg)",
          borderLeft: "1px solid var(--border)",
        }} />
      )}

      {showCreateModal && (
        <CreateTicketModal
          session={session}
          onCreated={handleTicketCreated}
          onClose={() => setShowCreateModal(false)}
        />
      )}
    </div>
  );
}
