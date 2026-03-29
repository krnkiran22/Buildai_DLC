"use client";

import { startTransition, useDeferredValue, useEffect, useState } from "react";
import { AdminInventoryPanel } from "@/components/admin-inventory-panel";
import { closeTicket, sendTicketMessage } from "@/lib/backend";
import type {
  BackendHealth,
  ChatMessage,
  DashboardSnapshot,
  PackageRecord,
  RoleCapability,
  RequestItem,
  TicketStatus,
  TimelineEvent,
  Tone,
  UserRole,
} from "@/lib/operations-types";

const statusOptions: Array<{ value: TicketStatus | "all"; label: string }> = [
  { value: "all", label: "All" },
  { value: "open", label: "Open" },
  { value: "accepted", label: "Accepted" },
  { value: "outbound_shipped", label: "Outbound" },
  { value: "return_shipped", label: "Return Shipped" },
  { value: "hq_received", label: "HQ Received" },
  { value: "transferred_to_ingestion", label: "To Ingestion" },
  { value: "ingestion_processing", label: "Ingestion" },
  { value: "ingestion_completed", label: "Ingestion Done" },
  { value: "closed", label: "Closed" },
];

function formatDate(value: string) {
  return new Intl.DateTimeFormat("en-US", {
    month: "short",
    day: "numeric",
    year: "numeric",
  }).format(new Date(value));
}

function formatDateTime(value: string) {
  return new Intl.DateTimeFormat("en-US", {
    month: "short",
    day: "numeric",
    hour: "numeric",
    minute: "2-digit",
  }).format(new Date(value));
}

function statusLabel(status: TicketStatus) {
  switch (status) {
    case "open":
      return "Open";
    case "accepted":
      return "Accepted";
    case "rejected":
      return "Rejected";
    case "outbound_shipped":
      return "Outbound Shipped";
    case "factory_received":
      return "Factory Received";
    case "return_shipped":
      return "Return Shipped";
    case "hq_received":
      return "HQ Received";
    case "transferred_to_ingestion":
      return "Sent To Ingestion";
    case "ingestion_processing":
      return "Ingestion Processing";
    case "ingestion_completed":
      return "Ingestion Completed";
    case "closed":
      return "Closed";
  }
}

function toneForStatus(status: TicketStatus): Tone {
  switch (status) {
    case "accepted":
    case "factory_received":
    case "ingestion_completed":
      return "success";
    case "open":
    case "outbound_shipped":
    case "transferred_to_ingestion":
      return "info";
    case "rejected":
      return "error";
    case "return_shipped":
    case "hq_received":
    case "ingestion_processing":
      return "warning";
    case "closed":
      return "neutral";
  }
}

function toneClass(tone: Tone) {
  switch (tone) {
    case "success":
      return "status-success";
    case "warning":
      return "status-warning";
    case "error":
      return "status-error";
    case "info":
      return "status-info";
    case "neutral":
      return "status-neutral";
  }
}

function StatusBadge({ status }: { status: TicketStatus }) {
  const tone = toneForStatus(status);

  return (
    <span
      className={`inline-flex items-center border px-2.5 py-1 text-[11px] font-semibold uppercase tracking-[0.16em] ${toneClass(tone)}`}
    >
      {statusLabel(status)}
    </span>
  );
}

function RoleBadge({ role }: { role: ChatMessage["role"] }) {
  const tone =
    role === "admin"
      ? "success"
      : role === "logistics"
        ? "info"
        : role === "ingestion"
          ? "warning"
          : "neutral";

  return (
    <span
      className={`inline-flex items-center border px-2 py-0.5 text-[10px] font-semibold uppercase tracking-[0.14em] ${toneClass(tone)}`}
    >
      {role}
    </span>
  );
}

function viewerRoleLabel(role: UserRole) {
  switch (role) {
    case "admin":
      return "Admin";
    case "logistics":
      return "Logistics";
    case "factory_operator":
      return "Factory Operator";
    case "ingestion":
      return "Ingestion";
  }
}

function PanelHeader({
  eyebrow,
  title,
  helper,
}: {
  eyebrow: string;
  title: string;
  helper: string;
}) {
  return (
    <div className="flex flex-col gap-2 border-b border-[color:var(--border)] px-5 py-4">
      <span className="font-mono text-[11px] font-semibold uppercase tracking-[0.24em] text-[color:var(--muted-foreground)]">
        {eyebrow}
      </span>
      <div className="space-y-1">
        <h2 className="font-display text-xl font-semibold tracking-[-0.03em] text-[color:var(--foreground)]">
          {title}
        </h2>
        <p className="max-w-2xl text-sm leading-6 text-[color:var(--muted-foreground)]">
          {helper}
        </p>
      </div>
    </div>
  );
}

function ItemTable({ items }: { items: RequestItem[] }) {
  return (
    <div className="overflow-hidden border border-[color:var(--border)]">
      <table className="w-full border-collapse text-left text-sm">
        <thead className="bg-[color:var(--muted)] text-[11px] uppercase tracking-[0.18em] text-[color:var(--muted-foreground)]">
          <tr>
            <th className="px-4 py-3 font-medium">Item</th>
            <th className="px-4 py-3 font-medium">Requested</th>
            <th className="px-4 py-3 font-medium">Approved</th>
            <th className="px-4 py-3 font-medium">Returned</th>
            <th className="px-4 py-3 font-medium">At HQ</th>
          </tr>
        </thead>
        <tbody>
          {items.map((item) => (
            <tr
              key={item.itemType}
              className="border-t border-[color:var(--border)] bg-white/70"
            >
              <td className="px-4 py-3 font-medium text-[color:var(--foreground)]">
                {item.itemType}
              </td>
              <td className="px-4 py-3 text-[color:var(--muted-foreground)]">
                {item.requestedQty}
              </td>
              <td className="px-4 py-3 text-[color:var(--muted-foreground)]">
                {item.approvedQty}
              </td>
              <td className="px-4 py-3 text-[color:var(--muted-foreground)]">
                {item.returnedQty}
              </td>
              <td className="px-4 py-3 text-[color:var(--muted-foreground)]">
                {item.receivedAtHqQty}
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

function PackageCard({ pkg }: { pkg: PackageRecord }) {
  return (
    <article className="border border-[color:var(--border)] bg-white/78 p-4">
      <div className="flex items-start justify-between gap-4">
        <div className="space-y-2">
          <div className="font-mono text-xs font-semibold uppercase tracking-[0.18em] text-[color:var(--muted-foreground)]">
            {pkg.packageCode}
          </div>
          <p className="text-sm text-[color:var(--foreground)]">{pkg.note}</p>
        </div>
        <StatusBadge status={pkg.status} />
      </div>
      <dl className="mt-4 grid gap-3 text-sm sm:grid-cols-3">
        <div>
          <dt className="text-[11px] uppercase tracking-[0.16em] text-[color:var(--muted-foreground)]">
            Direction
          </dt>
          <dd className="mt-1 font-medium text-[color:var(--foreground)]">
            {pkg.direction}
          </dd>
        </div>
        <div>
          <dt className="text-[11px] uppercase tracking-[0.16em] text-[color:var(--muted-foreground)]">
            QR Token
          </dt>
          <dd className="mt-1 font-mono text-[color:var(--foreground)]">{pkg.qrToken}</dd>
        </div>
        <div>
          <dt className="text-[11px] uppercase tracking-[0.16em] text-[color:var(--muted-foreground)]">
            Items
          </dt>
          <dd className="mt-1 font-medium text-[color:var(--foreground)]">{pkg.itemCount}</dd>
        </div>
      </dl>
    </article>
  );
}

function TimelineList({ events }: { events: TimelineEvent[] }) {
  return (
    <ol className="space-y-4">
      {events.map((event, index) => (
        <li key={event.id} className="flex gap-4">
          <div className="flex w-6 flex-col items-center">
            <span
              className={`mt-1 h-3.5 w-3.5 border ${toneClass(event.tone)}`}
              aria-hidden="true"
            />
            {index < events.length - 1 ? (
              <span className="mt-2 h-full w-px bg-[color:var(--border)]" aria-hidden="true" />
            ) : null}
          </div>
          <div className="pb-4">
            <div className="flex flex-wrap items-center gap-3">
              <h3 className="text-sm font-semibold text-[color:var(--foreground)]">
                {event.label}
              </h3>
              <span className="font-mono text-[11px] uppercase tracking-[0.14em] text-[color:var(--muted-foreground)]">
                {formatDateTime(event.occurredAt)}
              </span>
            </div>
            <p className="mt-2 text-sm leading-6 text-[color:var(--muted-foreground)]">
              {event.detail}
            </p>
            <p className="mt-2 text-xs uppercase tracking-[0.14em] text-[color:var(--muted-foreground)]">
              Actor: {event.actor}
            </p>
          </div>
        </li>
      ))}
    </ol>
  );
}

function RoleMatrixPanel({
  viewerRole,
  roleMatrix,
}: {
  viewerRole: UserRole;
  roleMatrix: RoleCapability[];
}) {
  return (
    <div className="border border-[color:var(--border)] bg-white/70 p-4 sm:p-5">
      <div className="flex items-center justify-between gap-4">
        <div>
          <p className="font-mono text-[11px] font-semibold uppercase tracking-[0.22em] text-[color:var(--muted-foreground)]">
            Hierarchy
          </p>
          <h2 className="mt-2 text-lg font-semibold tracking-[-0.03em] text-[color:var(--foreground)]">
            Who can do what
          </h2>
        </div>
        <span className="border border-[color:var(--border)] bg-[color:var(--muted)] px-3 py-1 text-[11px] font-semibold uppercase tracking-[0.16em] text-[color:var(--foreground)]">
          Viewing as {viewerRoleLabel(viewerRole)}
        </span>
      </div>
      <div className="mt-5 grid gap-3">
        {roleMatrix.map((entry) => (
          <article
            key={entry.role}
            className={`border p-3 ${
              entry.role === viewerRole
                ? "border-[color:var(--accent)] bg-[color:var(--accent-soft)]"
                : "border-[color:var(--border)] bg-[color:var(--muted)]"
            }`}
          >
            <div className="flex items-start justify-between gap-3">
              <div>
                <h3 className="text-sm font-semibold text-[color:var(--foreground)]">
                  {viewerRoleLabel(entry.role)}
                </h3>
                <p className="mt-1 text-xs uppercase tracking-[0.14em] text-[color:var(--muted-foreground)]">
                  {entry.permissions.join(" / ")}
                </p>
              </div>
              <div className="flex flex-col gap-2 text-right">
                <span
                  className={`inline-flex items-center border px-2 py-0.5 text-[10px] font-semibold uppercase tracking-[0.14em] ${
                    entry.canChat ? "status-success" : "status-neutral"
                  }`}
                >
                  {entry.canChat ? "Chat" : "Read Only"}
                </span>
                <span
                  className={`inline-flex items-center border px-2 py-0.5 text-[10px] font-semibold uppercase tracking-[0.14em] ${
                    entry.closeTickets ? "status-info" : "status-neutral"
                  }`}
                >
                  {entry.closeTickets ? "Can Close" : "No Close"}
                </span>
              </div>
            </div>
          </article>
        ))}
      </div>
    </div>
  );
}

export function OperationsDashboard({
  snapshot,
  health,
}: {
  snapshot: DashboardSnapshot;
  health: BackendHealth;
}) {
  const [currentSnapshot, setCurrentSnapshot] = useState(snapshot);
  const [query, setQuery] = useState("");
  const [statusFilter, setStatusFilter] = useState<TicketStatus | "all">("all");
  const [selectedTicketId, setSelectedTicketId] = useState(snapshot.highlightedTicketId);
  const [messageDraft, setMessageDraft] = useState("");
  const [messageFeedback, setMessageFeedback] = useState("");
  const [closeNote, setCloseNote] = useState("Operations verified. Closing ticket.");
  const [closeFeedback, setCloseFeedback] = useState("");
  const [messagePending, setMessagePending] = useState(false);
  const [closePending, setClosePending] = useState(false);
  const deferredQuery = useDeferredValue(query);

  const filteredTickets = currentSnapshot.tickets.filter((ticket) => {
    const queryMatch =
      deferredQuery.trim() === "" ||
      ticket.title.toLowerCase().includes(deferredQuery.toLowerCase()) ||
      ticket.teamName.toLowerCase().includes(deferredQuery.toLowerCase()) ||
      ticket.factoryName.toLowerCase().includes(deferredQuery.toLowerCase());
    const statusMatch = statusFilter === "all" || ticket.status === statusFilter;

    return queryMatch && statusMatch;
  });

  useEffect(() => {
    if (filteredTickets.some((ticket) => ticket.id === selectedTicketId)) {
      return;
    }

    if (!filteredTickets[0]) {
      return;
    }

    startTransition(() => {
      setSelectedTicketId(filteredTickets[0].id);
    });
  }, [filteredTickets, selectedTicketId]);

  const selectedTicket =
    filteredTickets.find((ticket) => ticket.id === selectedTicketId) ?? filteredTickets[0];
  const viewer = currentSnapshot.viewer;
  const canCloseTicket = viewer.permissions.includes("ticket.close");
  const canChat = viewer.permissions.includes("ticket.message");

  function upsertTicket(updatedTicket: (typeof currentSnapshot.tickets)[number]) {
    setCurrentSnapshot((current) => ({
      ...current,
      tickets: current.tickets.map((ticket) =>
        ticket.id === updatedTicket.id ? updatedTicket : ticket,
      ),
    }));
  }

  function localChatRole(role: UserRole): ChatMessage["role"] {
    if (role === "factory_operator") {
      return "operator";
    }
    return role;
  }

  async function handleSendMessage() {
    if (!selectedTicket || !messageDraft.trim()) {
      return;
    }

    const message = messageDraft.trim();
    setMessagePending(true);
    setMessageFeedback("");

    try {
      const updated = await sendTicketMessage(selectedTicket.id, message);
      if (updated) {
        upsertTicket(updated);
      } else {
        upsertTicket({
          ...selectedTicket,
          summary: `Latest update from ${viewer.name}: ${message.slice(0, 88)}`,
          messages: [
            ...selectedTicket.messages,
            {
              id: `msg_${String(selectedTicket.messages.length + 1).padStart(2, "0")}`,
              author: viewer.name,
              role: localChatRole(viewer.role),
              sentAt: new Date().toISOString(),
              message,
            },
          ],
        });
      }
      setMessageDraft("");
      setMessageFeedback("Message sent.");
    } catch (error) {
      setMessageFeedback(
        error instanceof Error ? error.message : "Failed to send message.",
      );
    } finally {
      setMessagePending(false);
    }
  }

  async function handleCloseTicket() {
    if (!selectedTicket || !closeNote.trim() || !canCloseTicket) {
      return;
    }

    setClosePending(true);
    setCloseFeedback("");

    try {
      const updated = await closeTicket(selectedTicket.id, closeNote.trim());
      if (updated) {
        upsertTicket(updated);
      } else {
        upsertTicket({
          ...selectedTicket,
          status: "closed",
          summary: `Ticket closed by ${viewer.name}. ${closeNote.trim()}`,
          nextAction: "Ticket closed by authorized operations staff.",
          messages: [
            ...selectedTicket.messages,
            {
              id: `msg_${String(selectedTicket.messages.length + 1).padStart(2, "0")}`,
              author: viewer.name,
              role: localChatRole(viewer.role),
              sentAt: new Date().toISOString(),
              message: `Ticket closed. ${closeNote.trim()}`,
            },
          ],
          timeline: [
            ...selectedTicket.timeline,
            {
              id: `evt_${String(selectedTicket.timeline.length + 1).padStart(2, "0")}`,
              label: "Ticket closed",
              detail: closeNote.trim(),
              occurredAt: new Date().toISOString(),
              actor: viewer.name,
              tone: "neutral",
            },
          ],
        });
      }
      setCloseFeedback("Ticket closed.");
    } catch (error) {
      setCloseFeedback(
        error instanceof Error ? error.message : "Failed to close ticket.",
      );
    } finally {
      setClosePending(false);
    }
  }

  return (
    <main className="grid-overlay min-h-screen">
      <div className="mx-auto flex w-full max-w-[1880px] flex-col gap-6 px-4 py-5 sm:px-6 lg:px-10 lg:py-8 2xl:px-14">
        <section className="panel-shell overflow-hidden">
          <div className="grid gap-6 border-b border-[color:var(--border)] px-5 py-5 lg:grid-cols-[1.35fr_1.05fr] lg:px-7 lg:py-7">
            <div className="space-y-5">
              <div className="flex flex-wrap items-center gap-3">
                <span className="border border-[color:var(--border)] bg-white px-3 py-1 font-mono text-[11px] font-semibold uppercase tracking-[0.24em] text-[color:var(--muted-foreground)]">
                  Build AI // Logistics OS
                </span>
                <span className="border border-[color:var(--border)] bg-[color:var(--accent-soft)] px-3 py-1 text-[11px] font-semibold uppercase tracking-[0.18em] text-[color:var(--info-foreground)]">
                  First module live in UI
                </span>
              </div>
              <div className="space-y-3">
                <h1 className="max-w-4xl font-display text-4xl font-semibold tracking-[-0.06em] text-[color:var(--foreground)] sm:text-5xl">
                  {snapshot.productName}
                </h1>
                <p className="max-w-3xl text-base leading-7 text-[color:var(--muted-foreground)] sm:text-lg">
                  One surface for factory operators, logistics, and ingestion staff to
                  track requests, packets, returns, and SD card reconciliation without
                  relying on marker-written pouches or manual follow-ups.
                </p>
              </div>
            </div>

            <div className="grid gap-4 xl:grid-cols-2">
              <div className="border border-[color:var(--border)] bg-white/70 p-4 sm:p-5">
                <div className="flex items-center justify-between gap-4">
                  <div>
                    <p className="font-mono text-[11px] font-semibold uppercase tracking-[0.22em] text-[color:var(--muted-foreground)]">
                      Flow locked
                    </p>
                    <h2 className="mt-2 text-lg font-semibold tracking-[-0.03em] text-[color:var(--foreground)]">
                      Ticket to ingestion
                    </h2>
                  </div>
                  <div className="text-right">
                    <span className="font-mono text-[11px] uppercase tracking-[0.16em] text-[color:var(--muted-foreground)]">
                      Updated {formatDateTime(currentSnapshot.generatedAt)}
                    </span>
                    <div className="mt-2 flex items-center justify-end gap-2">
                      <span
                        className={`inline-flex items-center border px-2.5 py-1 text-[11px] font-semibold uppercase tracking-[0.16em] ${
                          health.ok ? "status-success" : "status-error"
                        }`}
                      >
                        API {health.ok ? "Healthy" : "Unavailable"}
                      </span>
                      <span className="font-mono text-[11px] uppercase tracking-[0.14em] text-[color:var(--muted-foreground)]">
                        {health.environment}
                      </span>
                    </div>
                  </div>
                </div>
                <ol className="mt-5 grid gap-2 text-sm text-[color:var(--muted-foreground)]">
                  {[
                    "Open ticket",
                    "Accept or reject",
                    "Outbound shipped",
                    "Factory received",
                    "Return shipped",
                    "HQ received",
                    "Transfer to ingestion",
                    "Ingestion processing",
                    "Close with counts",
                  ].map((step, index) => (
                    <li
                      key={step}
                      className="flex items-center justify-between border border-[color:var(--border)] bg-[color:var(--muted)] px-3 py-2"
                    >
                      <span>{step}</span>
                      <span className="font-mono text-[11px] uppercase tracking-[0.14em]">
                        {String(index + 1).padStart(2, "0")}
                      </span>
                    </li>
                  ))}
                </ol>
              </div>

              <RoleMatrixPanel
                viewerRole={currentSnapshot.viewer.role}
                roleMatrix={currentSnapshot.roleMatrix}
              />
            </div>
          </div>

          <div className="grid gap-4 px-5 py-5 md:grid-cols-2 xl:grid-cols-5 lg:px-7">
            {snapshot.metrics.map((metric) => (
              <article
                key={metric.label}
                className="panel-shell metric-glow min-h-[154px] p-4"
              >
                <div className="flex h-full flex-col justify-between gap-4">
                  <div
                    className={`inline-flex self-start border px-2.5 py-1 text-[10px] font-semibold uppercase tracking-[0.16em] ${toneClass(metric.tone)}`}
                  >
                    {metric.label}
                  </div>
                  <div className="space-y-2">
                    <p className="font-display text-4xl font-semibold tracking-[-0.06em] text-[color:var(--foreground)]">
                      {metric.value}
                    </p>
                    <p className="text-sm leading-6 text-[color:var(--muted-foreground)]">
                      {metric.helper}
                    </p>
                  </div>
                </div>
              </article>
            ))}
          </div>
        </section>

        <section className="grid gap-6 xl:grid-cols-[0.82fr_1.48fr]">
          <section className="panel-shell overflow-hidden">
            <PanelHeader
              eyebrow="Ticket Queue"
              title="Requests visible to logistics"
              helper="Search the board, filter by lifecycle state, and open the ticket that needs action now."
            />

            <div className="grid gap-3 border-b border-[color:var(--border)] p-5">
              <label className="grid gap-2 text-sm text-[color:var(--muted-foreground)]">
                Search tickets
                <input
                  value={query}
                  onChange={(event) => setQuery(event.target.value)}
                  placeholder="Team, factory, or ticket title"
                  className="border border-[color:var(--border)] bg-white px-3 py-2.5 text-[color:var(--foreground)] outline-none transition focus:border-[color:var(--accent)]"
                />
              </label>
              <div className="flex flex-wrap gap-2">
                {statusOptions.map((option) => {
                  const active = statusFilter === option.value;

                  return (
                    <button
                      key={option.value}
                      type="button"
                      onClick={() => setStatusFilter(option.value)}
                      className={`border px-3 py-2 text-[11px] font-semibold uppercase tracking-[0.16em] transition ${
                        active
                          ? "border-[color:var(--accent)] bg-[color:var(--accent-soft)] text-[color:var(--info-foreground)]"
                          : "border-[color:var(--border)] bg-white text-[color:var(--muted-foreground)]"
                      }`}
                    >
                      {option.label}
                    </button>
                  );
                })}
              </div>
            </div>

            <div className="flex max-h-[980px] flex-col overflow-auto">
              {filteredTickets.map((ticket) => {
                const selected = ticket.id === selectedTicket?.id;

                return (
                  <button
                    key={ticket.id}
                    type="button"
                    onClick={() => setSelectedTicketId(ticket.id)}
                    className={`border-b border-[color:var(--border)] px-5 py-4 text-left transition ${
                      selected
                        ? "bg-[color:var(--accent-soft)]"
                        : "bg-white/65 hover:bg-[color:var(--muted)]"
                    }`}
                  >
                    <div className="flex flex-wrap items-start justify-between gap-3">
                      <div className="space-y-2">
                        <div className="flex flex-wrap items-center gap-2">
                          <StatusBadge status={ticket.status} />
                        <span className="border border-[color:var(--border)] px-2 py-0.5 text-[10px] font-semibold uppercase tracking-[0.14em] text-[color:var(--muted-foreground)]">
                            {ticket.priority}
                          </span>
                        </div>
                        <h3 className="text-sm font-semibold leading-6 text-[color:var(--foreground)]">
                          {ticket.title}
                        </h3>
                      </div>
                      <span className="font-mono text-[11px] uppercase tracking-[0.16em] text-[color:var(--muted-foreground)]">
                        {formatDate(ticket.deploymentDate)}
                      </span>
                    </div>
                    <div className="mt-3 grid gap-3 text-sm text-[color:var(--muted-foreground)] sm:grid-cols-3">
                      <p>Factory: {ticket.factoryName}</p>
                      <p>Devices: {ticket.devicesRequested}</p>
                      <p>SD cards: {ticket.sdCardsRequested}</p>
                    </div>
                    <p className="mt-3 text-sm leading-6 text-[color:var(--muted-foreground)]">
                      {ticket.summary}
                    </p>
                  </button>
                );
              })}
              {filteredTickets.length === 0 ? (
                <div className="px-5 py-10 text-sm text-[color:var(--muted-foreground)]">
                  No tickets match the current filter.
                </div>
              ) : null}
            </div>
          </section>

          {selectedTicket ? (
            <section className="grid gap-6">
              <section className="panel-shell overflow-hidden">
                <PanelHeader
                  eyebrow="Request Focus"
                  title={selectedTicket.teamName}
                  helper={selectedTicket.nextAction}
                />

                <div className="grid gap-6 p-5 lg:grid-cols-[1.15fr_0.85fr]">
                  <div className="space-y-5">
                    <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
                      <div className="border border-[color:var(--border)] bg-white/78 p-4">
                        <p className="text-[11px] uppercase tracking-[0.16em] text-[color:var(--muted-foreground)]">
                          Factory
                        </p>
                        <p className="mt-2 text-base font-semibold text-[color:var(--foreground)]">
                          {selectedTicket.factoryName}
                        </p>
                      </div>
                      <div className="border border-[color:var(--border)] bg-white/78 p-4">
                        <p className="text-[11px] uppercase tracking-[0.16em] text-[color:var(--muted-foreground)]">
                          Owner
                        </p>
                        <p className="mt-2 text-base font-semibold text-[color:var(--foreground)]">
                          {selectedTicket.requestOwner}
                        </p>
                      </div>
                      <div className="border border-[color:var(--border)] bg-white/78 p-4">
                        <p className="text-[11px] uppercase tracking-[0.16em] text-[color:var(--muted-foreground)]">
                          Workers
                        </p>
                        <p className="mt-2 text-base font-semibold text-[color:var(--foreground)]">
                          {selectedTicket.workerCount}
                        </p>
                      </div>
                      <div className="border border-[color:var(--border)] bg-white/78 p-4">
                        <p className="text-[11px] uppercase tracking-[0.16em] text-[color:var(--muted-foreground)]">
                          Status
                        </p>
                        <div className="mt-2">
                          <StatusBadge status={selectedTicket.status} />
                        </div>
                      </div>
                    </div>

                    <div className="space-y-3">
                      <div className="flex items-center justify-between gap-4">
                        <h3 className="text-lg font-semibold tracking-[-0.03em] text-[color:var(--foreground)]">
                          Requested inventory
                        </h3>
                        <span className="font-mono text-[11px] uppercase tracking-[0.14em] text-[color:var(--muted-foreground)]">
                          Deploys {formatDate(selectedTicket.deploymentDate)}
                        </span>
                      </div>
                      <ItemTable items={selectedTicket.items} />
                    </div>
                  </div>

                  <div className="space-y-4">
                    <div className="border border-[color:var(--border)] bg-white/78 p-4">
                      <div className="flex items-center justify-between gap-3">
                        <h3 className="text-lg font-semibold tracking-[-0.03em] text-[color:var(--foreground)]">
                          Ticket chat
                        </h3>
                        <span className="font-mono text-[11px] uppercase tracking-[0.14em] text-[color:var(--muted-foreground)]">
                          Logistics thread
                        </span>
                      </div>
                      <div className="mt-4 space-y-3">
                        {selectedTicket.messages.map((message) => (
                          <article
                            key={message.id}
                            className="border border-[color:var(--border)] bg-[color:var(--muted)] p-3"
                          >
                            <div className="flex flex-wrap items-center justify-between gap-3">
                              <div className="flex items-center gap-2">
                                <p className="text-sm font-semibold text-[color:var(--foreground)]">
                                  {message.author}
                                </p>
                                <RoleBadge role={message.role} />
                              </div>
                              <span className="font-mono text-[11px] uppercase tracking-[0.14em] text-[color:var(--muted-foreground)]">
                                {formatDateTime(message.sentAt)}
                              </span>
                            </div>
                            <p className="mt-3 text-sm leading-6 text-[color:var(--muted-foreground)]">
                              {message.message}
                            </p>
                          </article>
                        ))}
                      </div>
                      <div className="mt-4 border-t border-[color:var(--border)] pt-4">
                        <label className="grid gap-2 text-sm text-[color:var(--muted-foreground)]">
                          Send chat update
                          <textarea
                            value={messageDraft}
                            onChange={(event) => setMessageDraft(event.target.value)}
                            rows={3}
                            disabled={!canChat || messagePending}
                            className="border border-[color:var(--border)] bg-white px-3 py-2.5 text-[color:var(--foreground)] outline-none focus:border-[color:var(--accent)] disabled:opacity-60"
                            placeholder="Send a logistics or admin update into the ticket thread"
                          />
                        </label>
                        <div className="mt-3 flex items-center justify-between gap-3">
                          <span className="text-xs uppercase tracking-[0.14em] text-[color:var(--muted-foreground)]">
                            Posting as {viewerRoleLabel(viewer.role)}
                          </span>
                          <button
                            type="button"
                            onClick={() => void handleSendMessage()}
                            disabled={!canChat || messagePending || !messageDraft.trim()}
                            className="border border-[color:var(--foreground)] bg-[color:var(--foreground)] px-4 py-2 text-sm font-semibold text-white disabled:cursor-not-allowed disabled:opacity-60"
                          >
                            {messagePending ? "Sending..." : "Send Message"}
                          </button>
                        </div>
                        {messageFeedback ? (
                          <p className="mt-3 text-sm text-[color:var(--muted-foreground)]">
                            {messageFeedback}
                          </p>
                        ) : null}
                      </div>
                    </div>

                    <div className="border border-[color:var(--border)] bg-[color:var(--accent-soft)] p-4">
                      <p className="font-mono text-[11px] font-semibold uppercase tracking-[0.18em] text-[color:var(--info-foreground)]">
                        Control actions
                      </p>
                      <p className="mt-3 text-sm leading-6 text-[color:var(--foreground)]">
                        Admin and logistics can close tickets. Factory operators and
                        ingestion can chat and track, but they cannot close the workflow.
                      </p>
                      <label className="mt-4 grid gap-2 text-sm text-[color:var(--foreground)]">
                        Closure note
                        <textarea
                          value={closeNote}
                          onChange={(event) => setCloseNote(event.target.value)}
                          rows={3}
                          disabled={!canCloseTicket || closePending}
                          className="border border-[color:var(--border)] bg-white px-3 py-2.5 text-[color:var(--foreground)] outline-none focus:border-[color:var(--accent)] disabled:opacity-60"
                        />
                      </label>
                      <div className="mt-4 flex items-center justify-between gap-3">
                        <span className="text-xs uppercase tracking-[0.14em] text-[color:var(--muted-foreground)]">
                          {canCloseTicket
                            ? `Closing allowed for ${viewerRoleLabel(viewer.role)}`
                            : `${viewerRoleLabel(viewer.role)} cannot close tickets`}
                        </span>
                        <button
                          type="button"
                          onClick={() => void handleCloseTicket()}
                          disabled={
                            !canCloseTicket ||
                            closePending ||
                            !closeNote.trim() ||
                            selectedTicket.status === "open" ||
                            selectedTicket.status === "closed"
                          }
                          className="border border-[color:var(--foreground)] bg-[color:var(--foreground)] px-4 py-2 text-sm font-semibold text-white disabled:cursor-not-allowed disabled:opacity-60"
                        >
                          {closePending ? "Closing..." : "Close Ticket"}
                        </button>
                      </div>
                      {closeFeedback ? (
                        <p className="mt-3 text-sm text-[color:var(--muted-foreground)]">
                          {closeFeedback}
                        </p>
                      ) : null}
                    </div>
                  </div>
                </div>
              </section>

              <section className="grid gap-6 lg:grid-cols-[1.05fr_0.95fr]">
                <section className="panel-shell overflow-hidden">
                  <PanelHeader
                    eyebrow="Tracking"
                    title="Operator-visible lifecycle"
                    helper="The selected ticket exposes the same timeline to the factory team, HQ logistics, and admin."
                  />
                  <div className="p-5">
                    <TimelineList events={selectedTicket.timeline} />
                  </div>
                </section>

                <section className="grid gap-6">
                  <section className="panel-shell overflow-hidden">
                    <PanelHeader
                      eyebrow="Packet Identity"
                      title="QR-linked packets"
                      helper="Each shipment packet keeps a digital identity so ingestion never depends on handwritten pouch labels."
                    />
                    <div className="grid gap-4 p-5">
                      {selectedTicket.packages.map((pkg) => (
                        <PackageCard key={pkg.packageCode} pkg={pkg} />
                      ))}
                    </div>
                  </section>

                  <section className="panel-shell overflow-hidden">
                    <PanelHeader
                      eyebrow="Ingestion"
                      title="Reconciliation"
                      helper="Count what arrived, what processed successfully, and what is missing or red-marked."
                    />
                    <div className="grid gap-4 p-5">
                      {selectedTicket.ingestionReport ? (
                        <>
                          <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-5">
                            {[
                              {
                                label: "Expected",
                                value: selectedTicket.ingestionReport.expectedSdCards,
                              },
                              {
                                label: "Received",
                                value:
                                  selectedTicket.ingestionReport.actualSdCardsReceived,
                              },
                              {
                                label: "Processed",
                                value: selectedTicket.ingestionReport.processedSdCards,
                              },
                              {
                                label: "Missing",
                                value: selectedTicket.ingestionReport.missingSdCards,
                              },
                              {
                                label: "Faulty",
                                value: selectedTicket.ingestionReport.faultySdCards,
                              },
                            ].map((item) => (
                              <div
                                key={item.label}
                                className="border border-[color:var(--border)] bg-white/78 p-4"
                              >
                                <p className="text-[11px] uppercase tracking-[0.16em] text-[color:var(--muted-foreground)]">
                                  {item.label}
                                </p>
                                <p className="mt-2 font-display text-3xl font-semibold tracking-[-0.05em] text-[color:var(--foreground)]">
                                  {item.value}
                                </p>
                              </div>
                            ))}
                          </div>
                          <div className="border border-[color:var(--border)] bg-[color:var(--muted)] p-4">
                            <p className="text-sm font-semibold text-[color:var(--foreground)]">
                              Station {selectedTicket.ingestionReport.station} started{" "}
                              {formatDateTime(selectedTicket.ingestionReport.startedAt)}
                            </p>
                            <p className="mt-2 text-sm leading-6 text-[color:var(--muted-foreground)]">
                              {selectedTicket.ingestionReport.note}
                            </p>
                          </div>
                        </>
                      ) : (
                        <div className="border border-[color:var(--border)] bg-white/78 p-4 text-sm text-[color:var(--muted-foreground)]">
                          Ingestion has not started for this ticket yet.
                        </div>
                      )}
                    </div>
                  </section>
                </section>
              </section>
            </section>
          ) : (
            <section className="panel-shell flex min-h-[480px] items-center justify-center p-8 text-sm text-[color:var(--muted-foreground)]">
              No ticket selected.
            </section>
          )}
        </section>

        <section className="panel-shell overflow-hidden">
          <PanelHeader
            eyebrow="Ingestion Room"
            title="Packets visible to ingestion"
            helper="This queue is what the ingestion team sees after logistics hands off the return packet from HQ."
          />
          <div className="grid gap-4 p-5 md:grid-cols-2 xl:grid-cols-3">
            {snapshot.ingestionQueue.map((packet) => (
              <article
                key={packet.id}
                className="border border-[color:var(--border)] bg-white/78 p-4"
              >
                <div className="flex items-start justify-between gap-3">
                  <div>
                    <p className="font-mono text-[11px] font-semibold uppercase tracking-[0.18em] text-[color:var(--muted-foreground)]">
                      {packet.packageCode}
                    </p>
                    <h3 className="mt-2 text-lg font-semibold tracking-[-0.03em] text-[color:var(--foreground)]">
                      {packet.teamName}
                    </h3>
                    <p className="mt-1 text-sm text-[color:var(--muted-foreground)]">
                      {packet.factoryName}
                    </p>
                  </div>
                  <StatusBadge status={packet.status} />
                </div>
                <dl className="mt-5 grid gap-3 text-sm">
                  <div className="flex items-center justify-between gap-3">
                    <dt className="text-[color:var(--muted-foreground)]">Deployment date</dt>
                    <dd className="font-medium text-[color:var(--foreground)]">
                      {formatDate(packet.deploymentDate)}
                    </dd>
                  </div>
                  <div className="flex items-center justify-between gap-3">
                    <dt className="text-[color:var(--muted-foreground)]">Expected SD cards</dt>
                    <dd className="font-medium text-[color:var(--foreground)]">
                      {packet.expectedSdCards}
                    </dd>
                  </div>
                </dl>
              </article>
            ))}
          </div>
        </section>

        <AdminInventoryPanel initialItems={snapshot.inventoryItems} health={health} />
      </div>
    </main>
  );
}
