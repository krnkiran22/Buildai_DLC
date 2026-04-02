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
    return (
      <div style={{ height: "100%", display: "flex", flexDirection: "column", overflow: "hidden" }}>
        {/* Mobile breadcrumb nav */}
        {mobileView !== "list" && (
          <div style={{
            display: "flex", alignItems: "center", gap: 8,
            padding: "8px 12px", borderBottom: "1px solid var(--border)",
            background: "var(--bg)", flexShrink: 0,
          }}>
            <button
              onClick={() => setMobileView(mobileView === "detail" ? "chat" : "list")}
              style={{
                background: "none", border: "none", fontSize: 13,
                cursor: "pointer", color: "var(--text-secondary)",
                display: "flex", alignItems: "center", gap: 4, padding: "2px 0",
              }}
            >
              ← {mobileView === "detail" ? "Chat" : "Tickets"}
            </button>
            {selectedTicket && mobileView === "chat" && (
              <button
                onClick={() => setMobileView("detail")}
                style={{
                  marginLeft: "auto", background: "none",
                  border: "1px solid var(--border)", fontSize: 11,
                  cursor: "pointer", color: "var(--text-secondary)",
                  padding: "3px 10px",
                }}
              >
                Details →
              </button>
            )}
          </div>
        )}

        {/* Mobile pane views */}
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
            <div className="empty-state">
              <div className="empty-state-title">No ticket selected</div>
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
