"use client";

import { useCallback, useEffect, useState } from "react";
import { CreateTicketModal } from "@/components/tickets/create-ticket-modal";
import { TicketChatPanel } from "@/components/tickets/ticket-chat-panel";
import { TicketDetailPanel } from "@/components/tickets/ticket-detail-panel";
import { TicketListPanel } from "@/components/tickets/ticket-list-panel";
import type { AuthSession, DashboardSnapshot, TicketRecord } from "@/lib/operations-types";

type MobileView = "list" | "chat" | "detail";

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

  useEffect(() => {
    const check = () => setIsMobile(window.innerWidth <= 768);
    check();
    window.addEventListener("resize", check);
    return () => window.removeEventListener("resize", check);
  }, []);

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
    if (isMobile) setMobileView("chat");
  }, [isMobile]);

  function handleSelectTicket(id: string) {
    setSelectedId(id);
    if (isMobile) setMobileView("chat");
  }

  void onSessionChange;

  if (isMobile) {
    const tabLabel = (v: MobileView) => ({ list: "Tickets", chat: "Chat", detail: "Info" }[v]);
    const tabIcon  = (v: MobileView) => ({ list: "☰", chat: "💬", detail: "ℹ" }[v]);
    const canShowChat = !!selectedTicket;

    return (
      <div style={{ height: "100%", display: "flex", flexDirection: "column", overflow: "hidden" }}>
        {/* Active ticket title bar (when inside a ticket) */}
        {mobileView !== "list" && selectedTicket && (
          <div style={{
            padding: "8px 14px 6px", background: "var(--bg)",
            borderBottom: "1px solid var(--border)", flexShrink: 0,
            display: "flex", alignItems: "center", gap: 10,
          }}>
            <button
              onClick={() => setMobileView("list")}
              style={{
                background: "none", border: "none", fontSize: 20, lineHeight: 1,
                cursor: "pointer", color: "var(--text-secondary)", padding: "2px 4px",
              }}
              aria-label="Back to list"
            >←</button>
            <div style={{ flex: 1, minWidth: 0 }}>
              <div style={{ fontSize: 12, fontWeight: 700, color: "var(--text-primary)", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
                {selectedTicket.teamName}
              </div>
              <div style={{ fontSize: 10, color: "var(--text-muted)", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
                {selectedTicket.factoryName} · {selectedTicket.status.replace(/_/g, " ")}
              </div>
            </div>
          </div>
        )}

        {/* Pane content */}
        <div style={{ flex: 1, overflow: "hidden", display: "flex", flexDirection: "column" }}>
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
            <div className="empty-state" style={{ flex: 1 }}>
              <div className="empty-state-title">Select a ticket</div>
              <div className="empty-state-desc">Go back to the list and pick a ticket.</div>
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

        {/* Bottom tab bar */}
        <div style={{
          display: "flex", borderTop: "1px solid var(--border)",
          background: "var(--bg)", flexShrink: 0,
          paddingBottom: "env(safe-area-inset-bottom, 0px)",
        }}>
          {(["list", "chat", "detail"] as MobileView[]).map((v) => {
            const active = mobileView === v;
            const disabled = v !== "list" && !canShowChat;
            return (
              <button
                key={v}
                onClick={() => { if (!disabled) setMobileView(v); }}
                style={{
                  flex: 1, padding: "10px 4px 8px", border: "none",
                  background: "none", cursor: disabled ? "not-allowed" : "pointer",
                  display: "flex", flexDirection: "column", alignItems: "center", gap: 3,
                  borderTop: `2px solid ${active ? "var(--action)" : "transparent"}`,
                  opacity: disabled ? 0.3 : 1,
                }}
              >
                <span style={{ fontSize: 18, lineHeight: 1 }}>{tabIcon(v)}</span>
                <span style={{ fontSize: 10, fontWeight: active ? 700 : 400, color: active ? "var(--text-primary)" : "var(--text-muted)", fontFamily: "var(--font-mono)", textTransform: "uppercase", letterSpacing: "0.04em" }}>
                  {tabLabel(v)}
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

  // Desktop: three-pane
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
          <div className="empty-state">
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
