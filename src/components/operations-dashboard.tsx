"use client";

import Image from "next/image";
import { startTransition, useDeferredValue, useEffect, useEffectEvent, useState } from "react";
import { AdminInventoryPanel } from "@/components/admin-inventory-panel";
import {
  closeTicket,
  createTicket,
  createTicketPackagesBatch,
  getQrPackageDetail,
  openTicketStream,
  qrSvgUrl,
  saveIngestionReconciliation,
  sendTicketMessage,
  updateQrPackageDetail,
  updateTicketPackageStatus,
  updateTicketStatus,
} from "@/lib/backend";
import type {
  AuthSession,
  BackendHealth,
  ChatMessage,
  DashboardSnapshot,
  IngestionReconciliationInput,
  LiveTicketEvent,
  MeritScore,
  MovementRecord,
  PackageBatchCreateInput,
  PackageRecord,
  PublicQrPackagePatch,
  QrPackageDetail,
  RoleCapability,
  RequestItem,
  TicketCreateInput,
  TicketRecord,
  TicketStatus,
  TicketType,
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

const roleStatusTargets: Record<UserRole, TicketStatus[]> = {
  admin: [
    "accepted",
    "rejected",
    "outbound_shipped",
    "factory_received",
    "return_shipped",
    "hq_received",
    "transferred_to_ingestion",
    "ingestion_processing",
    "ingestion_completed",
    "closed",
  ],
  logistics: ["accepted", "rejected", "outbound_shipped", "factory_received"],
  factory_operator: ["return_shipped", "hq_received"],
  ingestion: ["transferred_to_ingestion", "ingestion_processing", "ingestion_completed"],
};

const transitionMap: Record<TicketStatus, TicketStatus[]> = {
  open: ["accepted", "rejected"],
  accepted: ["outbound_shipped"],
  rejected: [],
  outbound_shipped: ["factory_received"],
  factory_received: ["return_shipped"],
  return_shipped: ["hq_received"],
  hq_received: ["transferred_to_ingestion"],
  transferred_to_ingestion: ["ingestion_processing"],
  ingestion_processing: ["ingestion_completed"],
  ingestion_completed: ["closed"],
  closed: [],
};

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

function ticketTypeLabel(ticketType: TicketType) {
  return ticketType === "transfer" ? "Transfer" : "Deployment";
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

function TicketTypeBadge({ ticketType }: { ticketType: TicketType }) {
  const classes =
    ticketType === "transfer"
      ? "status-warning"
      : "status-neutral";

  return (
    <span
      className={`inline-flex items-center border px-2 py-0.5 text-[10px] font-semibold uppercase tracking-[0.14em] ${classes}`}
    >
      {ticketTypeLabel(ticketType)}
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

function validatePackageBatchDraft(
  draft: PackageBatchCreateInput,
  ticket: TicketRecord | undefined,
) {
  if (!ticket) {
    return "Select a ticket before generating QR labels.";
  }
  if (draft.labelCount <= 0) {
    return "Enter at least one QR label.";
  }
  if (draft.labelCount !== draft.packages.length) {
    return "QR label count must match the number of label rows.";
  }

  let totalSdCards = 0;
  let totalDevices = 0;

  for (const [index, entry] of draft.packages.entries()) {
    if (
      entry.shippedSdCardsCount < 0 ||
      entry.shippedDevicesCount < 0 ||
      entry.shippedUsbHubsCount < 0 ||
      entry.shippedCablesCount < 0
    ) {
      return `QR label ${index + 1} has an invalid shipped quantity.`;
    }
    if (!entry.note.trim()) {
      return `QR label ${index + 1} note is required.`;
    }

    const totalForLabel =
      entry.shippedSdCardsCount +
      entry.shippedDevicesCount +
      entry.shippedUsbHubsCount +
      entry.shippedCablesCount;
    if (totalForLabel <= 0) {
      return `QR label ${index + 1} must include at least one shipped item count.`;
    }

    totalSdCards += entry.shippedSdCardsCount;
    totalDevices += entry.shippedDevicesCount;
  }

  if (ticket.sdCardsRequested > 0 && totalSdCards <= 0) {
    return "Enter the shipped SD card count for at least one QR label.";
  }
  if (ticket.devicesRequested > 0 && totalDevices <= 0) {
    return "Enter the shipped device count for at least one QR label.";
  }

  return "";
}

function PanelHeader({
  eyebrow,
  title,
  helper,
}: {
  eyebrow: string;
  title: string;
  helper?: string;
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
        {helper ? (
          <p className="max-w-2xl text-sm leading-6 text-[color:var(--muted-foreground)]">
            {helper}
          </p>
        ) : null}
      </div>
    </div>
  );
}

function ItemTable({ items }: { items: RequestItem[] }) {
  return (
    <div className="overflow-x-auto border border-[color:var(--border)]">
      <table className="min-w-[640px] w-full border-collapse text-left text-sm">
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

function PackageCard({
  pkg,
  canEditQr,
  canUpdateStatus,
  availableActions,
  onSelectQr,
  onUpdateStatus,
  pending,
}: {
  pkg: PackageRecord;
  canEditQr: boolean;
  canUpdateStatus: boolean;
  availableActions: TicketStatus[];
  onSelectQr: (pkg: PackageRecord) => void;
  onUpdateStatus: (pkg: PackageRecord, nextStatus: TicketStatus) => void;
  pending: boolean;
}) {
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
          <dd className="mt-1 break-all font-mono text-[color:var(--foreground)]">{pkg.qrToken}</dd>
        </div>
        <div>
          <dt className="text-[11px] uppercase tracking-[0.16em] text-[color:var(--muted-foreground)]">
            Packed / Received
          </dt>
          <dd className="mt-1 font-medium text-[color:var(--foreground)]">
            SD {pkg.shippedSdCardsCount} / {pkg.receivedSdCardsCount ?? "-"}
          </dd>
        </div>
      </dl>
      <div className="mt-4 flex flex-wrap gap-2">
        <button
          type="button"
          onClick={() => onSelectQr(pkg)}
          className="border border-[color:var(--border)] bg-[color:var(--muted)] px-3 py-2 text-xs font-semibold uppercase tracking-[0.14em] text-[color:var(--foreground)]"
        >
          {canEditQr ? "Open QR Detail" : "View QR"}
        </button>
        {canUpdateStatus
          ? availableActions.map((action) => (
              <button
                key={`${pkg.packageCode}-${action}`}
                type="button"
                onClick={() => onUpdateStatus(pkg, action)}
                disabled={pending}
                className="border border-[color:var(--foreground)] bg-white px-3 py-2 text-xs font-semibold uppercase tracking-[0.14em] text-[color:var(--foreground)] disabled:opacity-60"
              >
                {statusLabel(action)}
              </button>
            ))
          : null}
      </div>
    </article>
  );
}

function MeritPanel({ scores }: { scores: MeritScore[] }) {
  return (
    <div className="border border-[color:var(--border)] bg-white/70 p-4 sm:p-5">
      <div className="flex items-center justify-between gap-4">
        <div>
          <p className="font-mono text-[11px] font-semibold uppercase tracking-[0.22em] text-[color:var(--muted-foreground)]">
            Team merit
          </p>
          <h2 className="mt-2 text-lg font-semibold tracking-[-0.03em] text-[color:var(--foreground)]">
            Return discipline scoreboard
          </h2>
        </div>
        <span className="border border-[color:var(--border)] bg-[color:var(--muted)] px-3 py-1 text-[11px] font-semibold uppercase tracking-[0.16em] text-[color:var(--foreground)]">
          SD 50 / Devices 25 / Accessories 25
        </span>
      </div>
      <div className="mt-5 grid gap-3 lg:grid-cols-2">
        {scores.map((score) => (
          <article key={score.teamName} className="border border-[color:var(--border)] bg-[color:var(--muted)] p-3">
            <div className="flex items-start justify-between gap-3">
              <div>
                <h3 className="text-sm font-semibold text-[color:var(--foreground)]">{score.teamName}</h3>
                <p className="mt-1 text-xs uppercase tracking-[0.14em] text-[color:var(--muted-foreground)]">
                  SD {score.sdCardShortfall} • Devices {score.deviceShortfall} • Accessories {score.accessoryShortfall}
                </p>
              </div>
              <span
                className={`inline-flex items-center border px-2.5 py-1 text-[11px] font-semibold uppercase tracking-[0.16em] ${
                  score.score >= 95 ? "status-success" : score.score >= 85 ? "status-warning" : "status-error"
                }`}
              >
                Score {score.score.toFixed(2)}
              </span>
            </div>
            <dl className="mt-4 grid gap-2 text-sm text-[color:var(--muted-foreground)]">
              <div className="flex items-center justify-between gap-3">
                <dt>SD card penalty</dt>
                <dd className="font-medium text-[color:var(--foreground)]">
                  {score.sdCardPenalty.toFixed(2)}
                </dd>
              </div>
              <div className="flex items-center justify-between gap-3">
                <dt>Device penalty</dt>
                <dd className="font-medium text-[color:var(--foreground)]">
                  {score.devicePenalty.toFixed(2)}
                </dd>
              </div>
              <div className="flex items-center justify-between gap-3">
                <dt>Accessory penalty</dt>
                <dd className="font-medium text-[color:var(--foreground)]">
                  {score.accessoryPenalty.toFixed(2)}
                </dd>
              </div>
            </dl>
          </article>
        ))}
      </div>
    </div>
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
  function capabilitySummary(entry: RoleCapability) {
    const items: string[] = [];
    if (entry.canCreateTickets) items.push("Create");
    if (entry.canUpdateStatus) items.push("Status");
    if (entry.closeTickets) items.push("Close");
    if (entry.editInventory) items.push("Inventory");
    if (entry.permissions.includes("ingestion.reconcile")) items.push("Reconcile");
    if (entry.permissions.includes("package.edit")) items.push("QR");
    return items;
  }

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
      <div className="mt-5 grid gap-3 lg:grid-cols-2">
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
                <div className="mt-2 flex flex-wrap gap-2">
                  {capabilitySummary(entry).map((item) => (
                    <span
                      key={`${entry.role}-${item}`}
                      className="border border-[color:var(--border)] bg-white/85 px-2 py-1 text-[10px] font-semibold uppercase tracking-[0.14em] text-[color:var(--muted-foreground)]"
                    >
                      {item}
                    </span>
                  ))}
                </div>
              </div>
              <div className="flex flex-col gap-2 text-left sm:text-right">
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

function MovementLedgerPanel({
  movements,
}: {
  movements: MovementRecord[];
}) {
  return (
    <section className="panel-shell overflow-hidden">
      <PanelHeader
        eyebrow="Movement Ledger"
        title="Full Device Movement History"
      />
      <div className="grid gap-4 p-5 md:grid-cols-2 2xl:grid-cols-3">
        {movements.map((movement) => (
          <article
            key={movement.id}
            className="border border-[color:var(--border)] bg-white/78 p-4"
          >
            <div className="flex flex-wrap items-start justify-between gap-3">
              <div className="min-w-0 space-y-2">
                <div className="flex flex-wrap items-center gap-2">
                  <TicketTypeBadge ticketType={movement.ticketType} />
                  <StatusBadge status={movement.status} />
                </div>
                <h3 className="break-words text-base font-semibold text-[color:var(--foreground)]">
                  {movement.routeSummary}
                </h3>
              </div>
              <span className="font-mono text-[11px] uppercase tracking-[0.14em] text-[color:var(--muted-foreground)]">
                {formatDateTime(movement.lastEventAt)}
              </span>
            </div>
            <dl className="mt-4 grid gap-2 text-sm text-[color:var(--muted-foreground)]">
              <div className="flex items-start justify-between gap-3">
                <dt>Source</dt>
                <dd className="max-w-[65%] text-right font-medium text-[color:var(--foreground)]">
                  {movement.sourceLabel}
                </dd>
              </div>
              <div className="flex items-start justify-between gap-3">
                <dt>Destination</dt>
                <dd className="max-w-[65%] text-right font-medium text-[color:var(--foreground)]">
                  {movement.destinationLabel}
                </dd>
              </div>
              <div className="flex items-center justify-between gap-3">
                <dt>Devices / SD</dt>
                <dd className="font-medium text-[color:var(--foreground)]">
                  {movement.devicesCount} / {movement.sdCardsCount}
                </dd>
              </div>
              <div className="flex items-center justify-between gap-3">
                <dt>Hubs / Cables</dt>
                <dd className="font-medium text-[color:var(--foreground)]">
                  {movement.usbHubsCount} / {movement.cablesCount}
                </dd>
              </div>
              <div className="flex items-center justify-between gap-3">
                <dt>Packets</dt>
                <dd className="font-medium text-[color:var(--foreground)]">
                  {movement.packageCount}
                </dd>
              </div>
              {movement.relatedTicketId ? (
                <div className="flex items-center justify-between gap-3">
                  <dt>Linked ticket</dt>
                  <dd className="font-mono text-[color:var(--foreground)]">
                    {movement.relatedTicketId}
                  </dd>
                </div>
              ) : null}
            </dl>
            <p className="mt-4 text-sm leading-6 text-[color:var(--muted-foreground)]">
              {movement.note}
            </p>
          </article>
        ))}
      </div>
    </section>
  );
}

export function OperationsDashboard({
  snapshot,
  health,
  session,
  onSessionChange,
  onLogout,
}: {
  snapshot: DashboardSnapshot;
  health: BackendHealth;
  session: AuthSession;
  onSessionChange: (session: AuthSession | null) => void;
  onLogout: () => void;
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
  const [statusNote, setStatusNote] = useState("");
  const [statusPending, setStatusPending] = useState(false);
  const [statusFeedback, setStatusFeedback] = useState("");
  const [packageActionNote, setPackageActionNote] = useState("");
  const [packagePending, setPackagePending] = useState(false);
  const [packageFeedback, setPackageFeedback] = useState("");
  const [packageDraft, setPackageDraft] = useState<PackageBatchCreateInput>({
    labelCount: 1,
    packages: [
      {
        shippedSdCardsCount: 0,
        shippedDevicesCount: 0,
        shippedUsbHubsCount: 0,
        shippedCablesCount: 0,
        note: "",
      },
    ],
  });
  const [packageCreatePending, setPackageCreatePending] = useState(false);
  const [packageCreateFeedback, setPackageCreateFeedback] = useState("");
  const [qrLookup, setQrLookup] = useState("");
  const [prefilledQrToken, setPrefilledQrToken] = useState("");
  const [qrDetail, setQrDetail] = useState<QrPackageDetail | null>(null);
  const [qrDraft, setQrDraft] = useState<PublicQrPackagePatch>({});
  const [qrPending, setQrPending] = useState(false);
  const [qrFeedback, setQrFeedback] = useState("");
  const [streamStatus, setStreamStatus] = useState("Live sync idle");
  const [reconciliationDraft, setReconciliationDraft] = useState<IngestionReconciliationInput>({
    station: "",
    expectedSdCards: 0,
    actualSdCardsReceived: 0,
    processedSdCards: 0,
    missingSdCards: 0,
    faultySdCards: 0,
    note: "",
    markCompleted: false,
  });
  const [reconciliationPending, setReconciliationPending] = useState(false);
  const [reconciliationFeedback, setReconciliationFeedback] = useState("");
  const [createPending, setCreatePending] = useState(false);
  const [createFeedback, setCreateFeedback] = useState("");
  const [ticketDraft, setTicketDraft] = useState<TicketCreateInput>({
    ticketType: "deployment",
    teamName: "",
    factoryName: "",
    sourceTeamName: "",
    sourceFactoryName: "",
    linkedTicketId: "",
    deploymentDate: "",
    workerCount: 0,
    devicesRequested: 0,
    sdCardsRequested: 0,
    priority: "medium",
  });
  const deferredQuery = useDeferredValue(query);
  const openTicketCount = currentSnapshot.tickets.filter(
    (ticket) => ticket.status !== "closed" && ticket.status !== "rejected",
  ).length;
  const packetCount = currentSnapshot.tickets.reduce(
    (total, ticket) => total + ticket.packages.length,
    0,
  );
  const activeMeritAlertCount = currentSnapshot.meritScores.filter((score) => score.score < 95).length;

  const filteredTickets = currentSnapshot.tickets.filter((ticket) => {
    const queryMatch =
      deferredQuery.trim() === "" ||
      ticket.title.toLowerCase().includes(deferredQuery.toLowerCase()) ||
      ticket.teamName.toLowerCase().includes(deferredQuery.toLowerCase()) ||
      ticket.factoryName.toLowerCase().includes(deferredQuery.toLowerCase()) ||
      (ticket.sourceTeamName ?? "").toLowerCase().includes(deferredQuery.toLowerCase()) ||
      (ticket.sourceFactoryName ?? "").toLowerCase().includes(deferredQuery.toLowerCase());
    const statusMatch = statusFilter === "all" || ticket.status === statusFilter;

    return queryMatch && statusMatch;
  });
  const selectedTicket =
    filteredTickets.find((ticket) => ticket.id === selectedTicketId) ?? filteredTickets[0];
  const seedSelectedTicketPanels = useEffectEvent((ticket: typeof selectedTicket) => {
    if (!ticket) {
      setQrDetail(null);
      return;
    }

    const firstPackage = ticket.packages[0];
    if (!qrLookup && firstPackage) {
      setQrLookup(firstPackage.qrToken);
      setQrDetail(localQrDetail(firstPackage));
    } else if (firstPackage && qrLookup === firstPackage.qrToken && !qrDetail) {
      setQrDetail(localQrDetail(firstPackage));
    }
    hydrateReconciliationDraft();
  });
  const syncQrDetailFromTicket = useEffectEvent((ticket: typeof selectedTicket) => {
    if (!ticket || !qrDetail) {
      return;
    }

    const nextPackage = ticket.packages.find((pkg) => pkg.qrToken === qrDetail.package.qrToken);
    if (!nextPackage) {
      return;
    }

    const unchanged =
      qrDetail.title === ticket.title &&
      qrDetail.teamName === (nextPackage.teamName ?? ticket.teamName) &&
      qrDetail.factoryName === (nextPackage.factoryName ?? ticket.factoryName) &&
      qrDetail.deploymentDate === (nextPackage.deploymentDate ?? "") &&
      qrDetail.package.status === nextPackage.status &&
      qrDetail.package.note === nextPackage.note &&
      qrDetail.package.receivedSdCardsCount === nextPackage.receivedSdCardsCount &&
      qrDetail.package.receivedDevicesCount === nextPackage.receivedDevicesCount &&
      qrDetail.package.direction === nextPackage.direction;
    if (unchanged) {
      return;
    }

    setQrDetail({
      ...qrDetail,
      title: ticket.title,
      teamName: nextPackage.teamName ?? ticket.teamName,
      factoryName: nextPackage.factoryName ?? ticket.factoryName,
      deploymentDate: nextPackage.deploymentDate ?? "",
      package: nextPackage,
    });
  });
  const handleStreamEvent = useEffectEvent((event: LiveTicketEvent) => {
    if (event.ticket) {
      upsertTicket(event.ticket);
      if (event.ticket.id === selectedTicket?.id) {
        setStreamStatus(`Live sync: ${event.eventType}`);
      }
    }
  });
  const handlePrefilledQrLoad = useEffectEvent((token: string) => {
    void handleLoadQrDetail(token);
  });

  useEffect(() => {
    setCurrentSnapshot(snapshot);
    setSelectedTicketId(snapshot.highlightedTicketId);
  }, [snapshot]);

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

  useEffect(() => {
    if (typeof window === "undefined") {
      return;
    }

    const token = new URLSearchParams(window.location.search).get("qr");
    if (!token) {
      return;
    }
    setQrLookup(token);
    setPrefilledQrToken(token);
  }, []);

  useEffect(() => {
    seedSelectedTicketPanels(selectedTicket);
  }, [selectedTicket]);

  useEffect(() => {
    syncQrDetailFromTicket(selectedTicket);
  }, [selectedTicket, qrDetail]);

  useEffect(() => {
    if (!selectedTicket || !session.token) {
      return;
    }

    const socket = openTicketStream(selectedTicket.id, session, handleStreamEvent);

    if (!socket) {
      return;
    }

    setStreamStatus("Live sync connecting");
    socket.onopen = () => setStreamStatus("Live sync connected");
    socket.onerror = () => setStreamStatus("Live sync error");
    socket.onclose = () => setStreamStatus("Live sync disconnected");

    const interval = window.setInterval(() => {
      if (socket.readyState === window.WebSocket.OPEN) {
        socket.send("ping");
      }
    }, 15000);

    return () => {
      window.clearInterval(interval);
      socket.close();
    };
  }, [selectedTicket, session]);

  useEffect(() => {
    if (!prefilledQrToken || !selectedTicket) {
      return;
    }
    handlePrefilledQrLoad(prefilledQrToken);
    setPrefilledQrToken("");
  }, [prefilledQrToken, selectedTicket]);

  const viewer = currentSnapshot.viewer;
  const canCloseTicket = viewer.permissions.includes("ticket.close");
  const canChat = viewer.permissions.includes("ticket.message");
  const canCreateTicket = viewer.permissions.includes("ticket.create");
  const canUpdateStatus = viewer.permissions.includes("ticket.status.update");
  const canEditPackages = viewer.permissions.includes("package.edit");
  const canUpdatePackageStatus = viewer.permissions.includes("package.status.update");
  const canViewPackages = viewer.permissions.includes("package.view");
  const canReconcileIngestion = viewer.permissions.includes("ingestion.reconcile");
  const availableStatusActions =
    selectedTicket && canUpdateStatus
      ? transitionMap[selectedTicket.status].filter((status) =>
          roleStatusTargets[viewer.role].includes(status),
        )
      : [];

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

  function localQrDetail(pkg: PackageRecord): QrPackageDetail {
    const editWindowExpiresAt = pkg.editWindowExpiresAt ?? null;
    const editable =
      !editWindowExpiresAt || new Date(editWindowExpiresAt).getTime() >= Date.now();
    return {
      ticketId: selectedTicket?.id ?? "",
      title: selectedTicket?.title ?? "",
      teamName: pkg.teamName ?? selectedTicket?.teamName ?? "",
      factoryName: pkg.factoryName ?? selectedTicket?.factoryName ?? "",
      deploymentDate: pkg.deploymentDate ?? "",
      package: pkg,
      scanUrl: typeof window !== "undefined" ? `${window.location.origin}/qr/${pkg.qrToken}` : "",
      qrSvgPath: "",
      editable,
      publicAccess: true,
      editWindowExpiresAt,
      lockedReason: editable ? null : "Edit window closed after end of the first saved day.",
    };
  }

  function hydrateReconciliationDraft() {
    if (!selectedTicket) {
      return;
    }

    setReconciliationDraft({
      station: selectedTicket.ingestionReport?.station ?? "",
      expectedSdCards:
        selectedTicket.ingestionReport?.expectedSdCards ?? selectedTicket.sdCardsRequested,
      actualSdCardsReceived:
        selectedTicket.ingestionReport?.actualSdCardsReceived ??
        selectedTicket.sdCardsRequested,
      processedSdCards:
        selectedTicket.ingestionReport?.processedSdCards ??
        selectedTicket.ingestionReport?.actualSdCardsReceived ??
        selectedTicket.sdCardsRequested,
      missingSdCards: selectedTicket.ingestionReport?.missingSdCards ?? 0,
      faultySdCards: selectedTicket.ingestionReport?.faultySdCards ?? 0,
      note: selectedTicket.ingestionReport?.note ?? "",
      startedAt: selectedTicket.ingestionReport?.startedAt,
      markCompleted: selectedTicket.status === "ingestion_completed",
    });
  }

  async function handleSendMessage() {
    if (!selectedTicket || !messageDraft.trim()) {
      return;
    }

    const message = messageDraft.trim();
    setMessagePending(true);
    setMessageFeedback("");

    try {
      const updated = await sendTicketMessage(selectedTicket.id, message, session);
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
      if (error instanceof Error && /401|403/i.test(error.message)) {
        onSessionChange(null);
      }
      setMessageFeedback(
        error instanceof Error ? error.message : "Failed to send message.",
      );
    } finally {
      setMessagePending(false);
    }
  }

  async function handleStatusUpdate(nextStatus: TicketStatus) {
    if (!selectedTicket || !canUpdateStatus) {
      return;
    }

    setStatusPending(true);
    setStatusFeedback("");

    try {
      const updated = await updateTicketStatus(
        selectedTicket.id,
        {
          status: nextStatus,
          note: statusNote.trim() || undefined,
        },
        session,
      );
      if (updated) {
        upsertTicket(updated);
        setStatusFeedback(`Moved ticket to ${statusLabel(nextStatus)}.`);
        setStatusNote("");
      } else {
        upsertTicket({
          ...selectedTicket,
          status: nextStatus,
          summary: statusNote.trim() || `Status changed to ${statusLabel(nextStatus)}.`,
          nextAction: "Next operational step should be completed by the assigned team.",
          timeline: [
            ...selectedTicket.timeline,
            {
              id: `evt_${String(selectedTicket.timeline.length + 1).padStart(2, "0")}`,
              label: statusLabel(nextStatus),
              detail: statusNote.trim() || `Moved to ${statusLabel(nextStatus)}.`,
              occurredAt: new Date().toISOString(),
              actor: viewer.name,
              tone: toneForStatus(nextStatus),
            },
          ],
        });
        setStatusFeedback(`Moved ticket to ${statusLabel(nextStatus)} locally.`);
      }
    } catch (error) {
      if (error instanceof Error && /401|403/i.test(error.message)) {
        onSessionChange(null);
      }
      setStatusFeedback(
        error instanceof Error ? error.message : "Failed to update status.",
      );
    } finally {
      setStatusPending(false);
    }
  }

  async function handleCloseTicket() {
    if (!selectedTicket || !closeNote.trim() || !canCloseTicket) {
      return;
    }

    setClosePending(true);
    setCloseFeedback("");

    try {
      const updated = await closeTicket(selectedTicket.id, closeNote.trim(), session);
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
      if (error instanceof Error && /401|403/i.test(error.message)) {
        onSessionChange(null);
      }
      setCloseFeedback(
        error instanceof Error ? error.message : "Failed to close ticket.",
      );
    } finally {
      setClosePending(false);
    }
  }

  async function handleCreateTicket() {
    if (!canCreateTicket) {
      return;
    }

    setCreatePending(true);
    setCreateFeedback("");

    try {
      const ticketPayload: TicketCreateInput = {
        ...ticketDraft,
        sourceTeamName: ticketDraft.sourceTeamName?.trim() || undefined,
        sourceFactoryName: ticketDraft.sourceFactoryName?.trim() || undefined,
        linkedTicketId: ticketDraft.linkedTicketId?.trim() || undefined,
      };
      const updated = await createTicket(ticketPayload, session);
      if (!updated) {
        throw new Error("Backend API is not configured.");
      }
      setCurrentSnapshot((current) => ({
        ...current,
        tickets: [updated, ...current.tickets],
        highlightedTicketId: updated.id,
      }));
      setSelectedTicketId(updated.id);
      setCreateFeedback("Ticket created.");
      setTicketDraft({
        ticketType: "deployment",
        teamName: "",
        factoryName: "",
        sourceTeamName: "",
        sourceFactoryName: "",
        linkedTicketId: "",
        deploymentDate: "",
        workerCount: 0,
        devicesRequested: 0,
        sdCardsRequested: 0,
        priority: "medium",
      });
    } catch (error) {
      if (error instanceof Error && /401|403/i.test(error.message)) {
        onSessionChange(null);
      }
      setCreateFeedback(error instanceof Error ? error.message : "Failed to create ticket.");
    } finally {
      setCreatePending(false);
    }
  }

  async function handleCreatePackage() {
    if (!selectedTicket || !canEditPackages) {
      return;
    }

    const validationMessage = validatePackageBatchDraft(packageDraft, selectedTicket);
    if (validationMessage) {
      setPackageCreateFeedback(validationMessage);
      return;
    }

    setPackageCreatePending(true);
    setPackageCreateFeedback("");
    try {
      const updated = await createTicketPackagesBatch(selectedTicket.id, packageDraft, session);
      if (updated) {
        upsertTicket(updated);
      } else {
        const nextPackages: PackageRecord[] = packageDraft.packages.map((entry, index) => ({
          packageCode: `PKG-RET-${selectedTicket.id.slice(-4).toUpperCase()}${String.fromCharCode(65 + selectedTicket.packages.length + index)}`,
          qrToken: `qr_local_${Date.now()}_${index}`,
          direction: "return",
          status: selectedTicket.status,
          itemCount: 1,
          shippedSdCardsCount: entry.shippedSdCardsCount,
          shippedDevicesCount: entry.shippedDevicesCount,
          shippedUsbHubsCount: entry.shippedUsbHubsCount,
          shippedCablesCount: entry.shippedCablesCount,
          receivedSdCardsCount: null,
          receivedDevicesCount: null,
          receivedUsbHubsCount: null,
          receivedCablesCount: null,
          note: entry.note,
          teamName: selectedTicket.teamName,
          factoryName: selectedTicket.factoryName,
          deploymentDate: null,
          updatedAt: new Date().toISOString(),
          updatedBy: viewer.name,
          firstEditAt: null,
          editWindowExpiresAt: null,
        }));
        upsertTicket({
          ...selectedTicket,
          packages: [...selectedTicket.packages, ...nextPackages],
        });
      }
      setPackageCreateFeedback("QR labels generated.");
      setPackageDraft({
        labelCount: 1,
        packages: [
          {
            shippedSdCardsCount: 0,
            shippedDevicesCount: 0,
            shippedUsbHubsCount: 0,
            shippedCablesCount: 0,
            note: "",
          },
        ],
      });
    } catch (error) {
      if (error instanceof Error && /401|403/i.test(error.message)) {
        onSessionChange(null);
      }
      setPackageCreateFeedback(
        error instanceof Error ? error.message : "Failed to create packet.",
      );
    } finally {
      setPackageCreatePending(false);
    }
  }

  async function handleLoadQrDetail(token?: string) {
    const resolvedToken = (token ?? qrLookup).trim();
    if (!resolvedToken) {
      return;
    }

      setQrPending(true);
    setQrFeedback("");
    try {
      const detail = await getQrPackageDetail(resolvedToken, session);
      if (detail) {
        if (detail.ticketId !== selectedTicket?.id) {
          setSelectedTicketId(detail.ticketId);
        }
        setQrDetail(detail);
        setQrDraft({
          teamName: detail.teamName,
          factoryName: detail.factoryName,
          deploymentDate: detail.deploymentDate,
          receivedSdCardsCount:
            detail.package.receivedSdCardsCount ?? detail.package.shippedSdCardsCount,
          receivedDevicesCount:
            detail.package.receivedDevicesCount ?? detail.package.shippedDevicesCount,
          receivedUsbHubsCount:
            detail.package.receivedUsbHubsCount ?? detail.package.shippedUsbHubsCount,
          receivedCablesCount:
            detail.package.receivedCablesCount ?? detail.package.shippedCablesCount,
          note: detail.package.note,
        });
      } else if (selectedTicket) {
        const localPackage = selectedTicket.packages.find((pkg) => pkg.qrToken === resolvedToken);
        if (localPackage) {
          const detail = localQrDetail(localPackage);
          setQrDetail(detail);
          setQrDraft({
            teamName: detail.teamName,
            factoryName: detail.factoryName,
            deploymentDate: detail.deploymentDate,
            receivedSdCardsCount:
              detail.package.receivedSdCardsCount ?? detail.package.shippedSdCardsCount,
            receivedDevicesCount:
              detail.package.receivedDevicesCount ?? detail.package.shippedDevicesCount,
            receivedUsbHubsCount:
              detail.package.receivedUsbHubsCount ?? detail.package.shippedUsbHubsCount,
            receivedCablesCount:
              detail.package.receivedCablesCount ?? detail.package.shippedCablesCount,
            note: detail.package.note,
          });
        }
      }
    } catch (error) {
      if (error instanceof Error && /401|403/i.test(error.message)) {
        onSessionChange(null);
      }
      setQrFeedback(error instanceof Error ? error.message : "Failed to load QR detail.");
    } finally {
      setQrPending(false);
    }
  }

  async function handleSaveQrDetail() {
    if (!qrDetail || !qrDetail.editable) {
      return;
    }

    setQrPending(true);
    setQrFeedback("");
    try {
      const updated = await updateQrPackageDetail(qrDetail.package.qrToken, qrDraft, session);
      if (updated) {
        setQrDetail(updated);
        setQrFeedback("QR detail updated.");
      }
    } catch (error) {
      if (error instanceof Error && /401|403/i.test(error.message)) {
        onSessionChange(null);
      }
      setQrFeedback(error instanceof Error ? error.message : "Failed to save QR detail.");
    } finally {
      setQrPending(false);
    }
  }

  async function handlePackageStatusAction(pkg: PackageRecord, nextStatus: TicketStatus) {
    if (!selectedTicket || !canUpdatePackageStatus) {
      return;
    }

    setPackagePending(true);
    setPackageFeedback("");
    try {
      const updated = await updateTicketPackageStatus(
        selectedTicket.id,
        pkg.packageCode,
        {
          status: nextStatus,
          note: packageActionNote.trim() || undefined,
        },
        session,
      );
      if (updated) {
        upsertTicket(updated);
      } else {
        upsertTicket({
          ...selectedTicket,
          packages: selectedTicket.packages.map((entry) =>
            entry.packageCode === pkg.packageCode
              ? {
                  ...entry,
                  status: nextStatus,
                  note: packageActionNote.trim() || entry.note,
                  updatedAt: new Date().toISOString(),
                  updatedBy: viewer.name,
                }
              : entry,
          ),
        });
      }
      setPackageActionNote("");
      setPackageFeedback(`${pkg.packageCode} moved to ${statusLabel(nextStatus)}.`);
    } catch (error) {
      if (error instanceof Error && /401|403/i.test(error.message)) {
        onSessionChange(null);
      }
      setPackageFeedback(
        error instanceof Error ? error.message : "Failed to update packet status.",
      );
    } finally {
      setPackagePending(false);
    }
  }

  async function handleSaveReconciliation() {
    if (!selectedTicket || !canReconcileIngestion) {
      return;
    }

    setReconciliationPending(true);
    setReconciliationFeedback("");
    try {
      const updated = await saveIngestionReconciliation(
        selectedTicket.id,
        reconciliationDraft,
        session,
      );
      if (updated) {
        upsertTicket(updated);
      } else {
        const nextStatus = reconciliationDraft.markCompleted
          ? "ingestion_completed"
          : selectedTicket.status === "transferred_to_ingestion"
            ? "ingestion_processing"
            : selectedTicket.status;
        upsertTicket({
          ...selectedTicket,
          status: nextStatus,
          ingestionReport: {
            station: reconciliationDraft.station,
            startedAt: reconciliationDraft.startedAt ?? new Date().toISOString(),
            expectedSdCards: reconciliationDraft.expectedSdCards,
            actualSdCardsReceived: reconciliationDraft.actualSdCardsReceived,
            processedSdCards: reconciliationDraft.processedSdCards,
            missingSdCards: reconciliationDraft.missingSdCards,
            faultySdCards: reconciliationDraft.faultySdCards,
            note: reconciliationDraft.note,
          },
        });
      }
      setReconciliationFeedback("Ingestion reconciliation saved.");
    } catch (error) {
      if (error instanceof Error && /401|403/i.test(error.message)) {
        onSessionChange(null);
      }
      setReconciliationFeedback(
        error instanceof Error ? error.message : "Failed to save reconciliation.",
      );
    } finally {
      setReconciliationPending(false);
    }
  }

  return (
    <main className="grid-overlay min-h-screen">
      <div className="mx-auto flex w-full max-w-[1920px] flex-col gap-4 px-3 py-4 sm:px-5 lg:px-7 lg:py-5 2xl:px-8">
        <section className="panel-shell overflow-hidden">
          <div className="grid gap-4 border-b border-[color:var(--border)] px-4 py-4 lg:px-6 lg:py-4 2xl:grid-cols-[minmax(0,1.65fr)_minmax(360px,0.75fr)]">
            <div className="min-w-0 space-y-4">
              <div className="flex flex-wrap items-center gap-3">
                <span className="border border-[color:var(--border)] bg-white px-3 py-1 font-mono text-[11px] font-semibold uppercase tracking-[0.24em] text-[color:var(--muted-foreground)]">
                  Build AI // Logistics OS
                </span>
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
              <div className="space-y-2">
                <h1 className="max-w-4xl font-display text-3xl font-semibold tracking-[-0.06em] text-[color:var(--foreground)] sm:text-4xl">
                  {currentSnapshot.productName}
                </h1>
              </div>
              <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
                <div className="border border-[color:var(--border)] bg-white/78 px-4 py-4">
                  <p className="text-[11px] uppercase tracking-[0.16em] text-[color:var(--muted-foreground)]">
                    Active role
                  </p>
                  <p className="mt-2 text-base font-semibold text-[color:var(--foreground)]">
                    {viewerRoleLabel(session.user.role)}
                  </p>
                </div>
                <div className="border border-[color:var(--border)] bg-white/78 px-4 py-4">
                  <p className="text-[11px] uppercase tracking-[0.16em] text-[color:var(--muted-foreground)]">
                    Open tickets
                  </p>
                  <p className="mt-2 font-display text-3xl font-semibold tracking-[-0.05em] text-[color:var(--foreground)]">
                    {openTicketCount}
                  </p>
                </div>
                <div className="border border-[color:var(--border)] bg-white/78 px-4 py-4">
                  <p className="text-[11px] uppercase tracking-[0.16em] text-[color:var(--muted-foreground)]">
                    Active packets
                  </p>
                  <p className="mt-2 font-display text-3xl font-semibold tracking-[-0.05em] text-[color:var(--foreground)]">
                    {packetCount}
                  </p>
                </div>
                <div className="border border-[color:var(--border)] bg-white/78 px-4 py-4">
                  <p className="text-[11px] uppercase tracking-[0.16em] text-[color:var(--muted-foreground)]">
                    Merit alerts
                  </p>
                  <p className="mt-2 font-display text-3xl font-semibold tracking-[-0.05em] text-[color:var(--foreground)]">
                    {activeMeritAlertCount}
                  </p>
                </div>
              </div>
            </div>

            <div className="grid gap-4">
              <div className="border border-[color:var(--border)] bg-white/70 p-4 sm:p-5">
                <div className="flex flex-wrap items-start justify-between gap-4">
                  <div>
                    <p className="font-mono text-[11px] font-semibold uppercase tracking-[0.22em] text-[color:var(--muted-foreground)]">
                      System
                    </p>
                    <h2 className="mt-2 text-lg font-semibold tracking-[-0.03em] text-[color:var(--foreground)]">
                      Operations status
                    </h2>
                  </div>
                  <div className="text-right">
                    <span className="font-mono text-[11px] uppercase tracking-[0.16em] text-[color:var(--muted-foreground)]">
                      Updated {formatDateTime(currentSnapshot.generatedAt)}
                    </span>
                  </div>
                </div>
                <div className="mt-5 grid gap-3 sm:grid-cols-2">
                  <div className="border border-[color:var(--border)] bg-[color:var(--muted)] px-3 py-3">
                    <p className="text-[11px] uppercase tracking-[0.16em] text-[color:var(--muted-foreground)]">
                      Open flow
                    </p>
                    <p className="mt-2 text-sm font-semibold text-[color:var(--foreground)]">
                      {openTicketCount} active tickets
                    </p>
                  </div>
                  <div className="border border-[color:var(--border)] bg-[color:var(--muted)] px-3 py-3">
                    <p className="text-[11px] uppercase tracking-[0.16em] text-[color:var(--muted-foreground)]">
                      Connected backend
                    </p>
                    <p className="mt-2 text-sm font-semibold text-[color:var(--foreground)]">
                      {health.baseUrl.replace(/^https?:\/\//, "")}
                    </p>
                  </div>
                  <div className="border border-[color:var(--border)] bg-[color:var(--muted)] px-3 py-3">
                    <p className="text-[11px] uppercase tracking-[0.16em] text-[color:var(--muted-foreground)]">
                      User
                    </p>
                    <p className="mt-2 text-sm font-semibold text-[color:var(--foreground)]">
                      {session.user.displayName}
                    </p>
                  </div>
                  <div className="border border-[color:var(--border)] bg-[color:var(--muted)] px-3 py-3">
                    <p className="text-[11px] uppercase tracking-[0.16em] text-[color:var(--muted-foreground)]">
                      Email
                    </p>
                    <p className="mt-2 break-all text-sm font-semibold text-[color:var(--foreground)]">
                      {session.user.email}
                    </p>
                  </div>
                </div>
                <div className="mt-4 flex flex-wrap items-center justify-between gap-3">
                  <span className="border border-[color:var(--border)] bg-[color:var(--muted)] px-3 py-1 text-[11px] font-semibold uppercase tracking-[0.16em] text-[color:var(--foreground)]">
                    {viewerRoleLabel(session.user.role)}
                  </span>
                  <button
                    type="button"
                    onClick={onLogout}
                    className="border border-[color:var(--border)] bg-white px-3 py-2 text-sm font-semibold text-[color:var(--foreground)]"
                  >
                    Sign Out
                  </button>
                </div>
              </div>
            </div>
          </div>

          <div className="grid gap-3 px-4 py-4 md:grid-cols-2 xl:grid-cols-5 lg:px-6 lg:py-4">
            {currentSnapshot.metrics.map((metric) => (
              <article
                key={metric.label}
                className="panel-shell metric-glow min-h-[126px] p-3.5"
              >
                <div className="flex h-full flex-col justify-between gap-3">
                  <div
                    className={`inline-flex self-start border px-2.5 py-1 text-[10px] font-semibold uppercase tracking-[0.16em] ${toneClass(metric.tone)}`}
                  >
                    {metric.label}
                  </div>
                  <div className="space-y-2">
                    <p className="font-display text-3xl font-semibold tracking-[-0.06em] text-[color:var(--foreground)]">
                      {metric.value}
                    </p>
                    <p className="text-xs leading-5 text-[color:var(--muted-foreground)]">
                      {metric.helper}
                    </p>
                  </div>
                </div>
              </article>
            ))}
          </div>
        </section>

        <section className="grid items-start gap-4 xl:grid-cols-[320px_minmax(0,1fr)] 2xl:grid-cols-[340px_minmax(0,1fr)]">
          <section className="panel-shell overflow-hidden xl:sticky xl:top-4">
            <PanelHeader
              eyebrow="Ticket Queue"
              title="Requests visible to logistics"
            />

            <div className="grid gap-3 border-b border-[color:var(--border)] p-5">
              {canCreateTicket ? (
                <div className="grid gap-3 border border-[color:var(--border)] bg-[color:var(--muted)] p-4">
                  <div className="flex items-center justify-between gap-3">
                    <div>
                      <p className="font-mono text-[11px] uppercase tracking-[0.16em] text-[color:var(--muted-foreground)]">
                        Raise ticket
                      </p>
                      <h3 className="mt-1 text-base font-semibold text-[color:var(--foreground)]">
                        Factory-side request and transfer form
                      </h3>
                    </div>
                    <span className="text-xs uppercase tracking-[0.14em] text-[color:var(--muted-foreground)]">
                      {viewerRoleLabel(viewer.role)}
                    </span>
                  </div>
                  <div className="grid gap-3 sm:grid-cols-2">
                    <select
                      value={ticketDraft.ticketType}
                      onChange={(event) =>
                        setTicketDraft((current) => ({
                          ...current,
                          ticketType: event.target.value as TicketType,
                        }))
                      }
                      className="border border-[color:var(--border)] bg-white px-3 py-2.5 text-sm text-[color:var(--foreground)] outline-none focus:border-[color:var(--accent)]"
                    >
                      <option value="deployment">Deployment request</option>
                      <option value="transfer">Factory transfer</option>
                    </select>
                    <input
                      value={ticketDraft.teamName}
                      onChange={(event) =>
                        setTicketDraft((current) => ({ ...current, teamName: event.target.value }))
                      }
                      placeholder={
                        ticketDraft.ticketType === "transfer"
                          ? "Destination team name"
                          : "Team name"
                      }
                      className="border border-[color:var(--border)] bg-white px-3 py-2.5 text-sm text-[color:var(--foreground)] outline-none focus:border-[color:var(--accent)]"
                    />
                    <input
                      value={ticketDraft.factoryName}
                      onChange={(event) =>
                        setTicketDraft((current) => ({
                          ...current,
                          factoryName: event.target.value,
                        }))
                      }
                      placeholder={
                        ticketDraft.ticketType === "transfer"
                          ? "Destination factory name"
                          : "Factory name"
                      }
                      className="border border-[color:var(--border)] bg-white px-3 py-2.5 text-sm text-[color:var(--foreground)] outline-none focus:border-[color:var(--accent)]"
                    />
                    {ticketDraft.ticketType === "transfer" ? (
                      <>
                        <input
                          value={ticketDraft.sourceTeamName ?? ""}
                          onChange={(event) =>
                            setTicketDraft((current) => ({
                              ...current,
                              sourceTeamName: event.target.value,
                            }))
                          }
                          placeholder="Source team name"
                          className="border border-[color:var(--border)] bg-white px-3 py-2.5 text-sm text-[color:var(--foreground)] outline-none focus:border-[color:var(--accent)]"
                        />
                        <input
                          value={ticketDraft.sourceFactoryName ?? ""}
                          onChange={(event) =>
                            setTicketDraft((current) => ({
                              ...current,
                              sourceFactoryName: event.target.value,
                            }))
                          }
                          placeholder="Source factory name"
                          className="border border-[color:var(--border)] bg-white px-3 py-2.5 text-sm text-[color:var(--foreground)] outline-none focus:border-[color:var(--accent)]"
                        />
                      </>
                    ) : null}
                    <input
                      type="date"
                      value={ticketDraft.deploymentDate}
                      onChange={(event) =>
                        setTicketDraft((current) => ({
                          ...current,
                          deploymentDate: event.target.value,
                        }))
                      }
                      className="border border-[color:var(--border)] bg-white px-3 py-2.5 text-sm text-[color:var(--foreground)] outline-none focus:border-[color:var(--accent)]"
                    />
                    {ticketDraft.ticketType === "transfer" ? (
                      <input
                        value={ticketDraft.linkedTicketId ?? ""}
                        onChange={(event) =>
                          setTicketDraft((current) => ({
                            ...current,
                            linkedTicketId: event.target.value,
                          }))
                        }
                        placeholder="Linked source ticket ID"
                        className="border border-[color:var(--border)] bg-white px-3 py-2.5 text-sm text-[color:var(--foreground)] outline-none focus:border-[color:var(--accent)]"
                      />
                    ) : null}
                    <input
                      type="number"
                      value={ticketDraft.workerCount || ""}
                      onChange={(event) =>
                        setTicketDraft((current) => ({
                          ...current,
                          workerCount: Number(event.target.value),
                        }))
                      }
                      placeholder="Workers"
                      className="border border-[color:var(--border)] bg-white px-3 py-2.5 text-sm text-[color:var(--foreground)] outline-none focus:border-[color:var(--accent)]"
                    />
                    <input
                      type="number"
                      value={ticketDraft.devicesRequested || ""}
                      onChange={(event) =>
                        setTicketDraft((current) => ({
                          ...current,
                          devicesRequested: Number(event.target.value),
                        }))
                      }
                      placeholder="Devices requested"
                      className="border border-[color:var(--border)] bg-white px-3 py-2.5 text-sm text-[color:var(--foreground)] outline-none focus:border-[color:var(--accent)]"
                    />
                    <input
                      type="number"
                      value={ticketDraft.sdCardsRequested || ""}
                      onChange={(event) =>
                        setTicketDraft((current) => ({
                          ...current,
                          sdCardsRequested: Number(event.target.value),
                        }))
                      }
                      placeholder="SD cards requested"
                      className="border border-[color:var(--border)] bg-white px-3 py-2.5 text-sm text-[color:var(--foreground)] outline-none focus:border-[color:var(--accent)]"
                    />
                  </div>
                  <div className="flex flex-wrap items-center justify-between gap-3">
                    <select
                      value={ticketDraft.priority}
                      onChange={(event) =>
                        setTicketDraft((current) => ({
                          ...current,
                          priority: event.target.value as TicketCreateInput["priority"],
                        }))
                      }
                      className="border border-[color:var(--border)] bg-white px-3 py-2.5 text-sm text-[color:var(--foreground)] outline-none focus:border-[color:var(--accent)]"
                    >
                      <option value="high">High</option>
                      <option value="medium">Medium</option>
                      <option value="low">Low</option>
                    </select>
                    <button
                      type="button"
                      onClick={() => void handleCreateTicket()}
                      disabled={
                        createPending ||
                        !ticketDraft.teamName ||
                        !ticketDraft.factoryName ||
                        !ticketDraft.deploymentDate ||
                        ticketDraft.workerCount <= 0 ||
                        (ticketDraft.ticketType === "transfer" &&
                          (!ticketDraft.sourceTeamName || !ticketDraft.sourceFactoryName))
                      }
                      className="border border-[color:var(--foreground)] bg-[color:var(--foreground)] px-4 py-2 text-sm font-semibold text-white disabled:opacity-60"
                    >
                      {createPending
                        ? "Creating..."
                        : ticketDraft.ticketType === "transfer"
                          ? "Create Transfer"
                          : "Create Ticket"}
                    </button>
                  </div>
                  {createFeedback ? (
                    <p className="text-sm text-[color:var(--muted-foreground)]">{createFeedback}</p>
                  ) : null}
                </div>
              ) : null}
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

            <div className="flex flex-col xl:max-h-[980px] xl:overflow-auto">
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
                          <TicketTypeBadge ticketType={ticket.ticketType} />
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
                    {ticket.ticketType === "transfer" ? (
                      <p className="mt-2 text-sm text-[color:var(--muted-foreground)]">
                        Source: {ticket.sourceTeamName} / {ticket.sourceFactoryName}
                      </p>
                    ) : null}
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
            <section className="grid min-w-0 gap-4">
              <section className="panel-shell overflow-hidden">
                <PanelHeader
                  eyebrow="Request Focus"
                  title={selectedTicket.teamName}
                />

                <div className="grid gap-4 p-4 lg:p-5 xl:grid-cols-[minmax(0,1.35fr)_320px]">
                  <div className="grid gap-3 sm:grid-cols-2 xl:col-span-2 xl:grid-cols-5">
                      <div className="border border-[color:var(--border)] bg-white/78 p-4">
                        <p className="text-[11px] uppercase tracking-[0.16em] text-[color:var(--muted-foreground)]">
                          Ticket type
                        </p>
                        <div className="mt-2">
                          <TicketTypeBadge ticketType={selectedTicket.ticketType} />
                        </div>
                      </div>
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
                  <div className="min-w-0 space-y-4">
                    {selectedTicket.ticketType === "transfer" ? (
                      <div className="border border-[color:var(--border)] bg-[color:var(--accent-soft)] p-4">
                        <p className="font-mono text-[11px] uppercase tracking-[0.16em] text-[color:var(--info-foreground)]">
                          Transfer chain
                        </p>
                        <p className="mt-2 text-sm leading-6 text-[color:var(--foreground)]">
                          Source {selectedTicket.sourceTeamName} / {selectedTicket.sourceFactoryName}
                          {" "}to destination {selectedTicket.teamName} / {selectedTicket.factoryName}.
                        </p>
                        {selectedTicket.linkedTicketId ? (
                          <p className="mt-2 font-mono text-[11px] uppercase tracking-[0.14em] text-[color:var(--muted-foreground)]">
                            Linked ticket {selectedTicket.linkedTicketId}
                          </p>
                        ) : null}
                      </div>
                    ) : null}

                    <div className="space-y-3">
                      <div className="flex items-center justify-between gap-4">
                        <h3 className="text-lg font-semibold tracking-[-0.03em] text-[color:var(--foreground)]">
                          {selectedTicket.ticketType === "transfer"
                            ? "Transfer inventory"
                            : "Requested inventory"}
                        </h3>
                        <span className="font-mono text-[11px] uppercase tracking-[0.14em] text-[color:var(--muted-foreground)]">
                          Deploys {formatDate(selectedTicket.deploymentDate)}
                        </span>
                      </div>
                      <ItemTable items={selectedTicket.items} />
                    </div>
                  </div>

                  <div className="space-y-4 xl:row-span-2 xl:self-start">
                    <div className="border border-[color:var(--border)] bg-white/78 p-4">
                      <div className="flex items-center justify-between gap-3">
                        <h3 className="text-lg font-semibold tracking-[-0.03em] text-[color:var(--foreground)]">
                          Ticket chat
                        </h3>
                        <span className="font-mono text-[11px] uppercase tracking-[0.14em] text-[color:var(--muted-foreground)]">
                          {streamStatus}
                        </span>
                      </div>
                      <div className="mt-4 space-y-3 xl:max-h-[360px] xl:overflow-auto xl:pr-1">
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
                        <div className="mt-3 flex flex-wrap items-center justify-between gap-3">
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
                      <label className="mt-3 grid gap-2 text-sm text-[color:var(--foreground)]">
                        Status note
                        <textarea
                          value={statusNote}
                          onChange={(event) => setStatusNote(event.target.value)}
                          rows={3}
                          disabled={!canUpdateStatus || statusPending}
                          className="border border-[color:var(--border)] bg-white px-3 py-2.5 text-[color:var(--foreground)] outline-none focus:border-[color:var(--accent)] disabled:opacity-60"
                          placeholder="Add the operational note for this transition"
                        />
                      </label>
                      <div className="mt-4 flex flex-wrap gap-2">
                        {availableStatusActions.length > 0 ? (
                          availableStatusActions.map((action) => (
                            <button
                              key={action}
                              type="button"
                              onClick={() => void handleStatusUpdate(action)}
                              disabled={statusPending}
                              className="border border-[color:var(--foreground)] bg-white px-3 py-2 text-sm font-semibold text-[color:var(--foreground)] disabled:opacity-60"
                            >
                              {statusPending ? "Updating..." : statusLabel(action)}
                            </button>
                          ))
                        ) : (
                          <span className="text-xs uppercase tracking-[0.14em] text-[color:var(--muted-foreground)]">
                            No status actions available for this role at the current step.
                          </span>
                        )}
                      </div>
                      {statusFeedback ? (
                        <p className="mt-3 text-sm text-[color:var(--muted-foreground)]">
                          {statusFeedback}
                        </p>
                      ) : null}
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
                      <div className="mt-4 flex flex-wrap items-center justify-between gap-3">
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

              <section className="grid gap-4 2xl:grid-cols-[minmax(0,0.95fr)_minmax(0,1.05fr)]">
                <section className="panel-shell overflow-hidden">
                  <PanelHeader
                    eyebrow="Tracking"
                    title="Operator-visible lifecycle"
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
                    />
                    <div className="grid gap-5 p-5">
                      {canEditPackages && (viewer.role === "admin" || viewer.role === "logistics") ? (
                        <div className="grid gap-3 border border-[color:var(--border)] bg-[color:var(--muted)] p-4">
                          <div className="flex items-center justify-between gap-3">
                            <div>
                              <p className="font-mono text-[11px] uppercase tracking-[0.16em] text-[color:var(--muted-foreground)]">
                                Generate labels
                              </p>
                              <h3 className="mt-1 text-base font-semibold text-[color:var(--foreground)]">
                                Create QR batch
                              </h3>
                            </div>
                            <span className="text-xs uppercase tracking-[0.14em] text-[color:var(--muted-foreground)]">
                              {viewerRoleLabel(viewer.role)}
                            </span>
                          </div>
                          <div className="grid gap-3 sm:grid-cols-2 2xl:grid-cols-3">
                            <input
                              type="number"
                              min={1}
                              value={packageDraft.labelCount || ""}
                              onChange={(event) =>
                                setPackageDraft((current) => ({
                                  ...current,
                                  labelCount: Number(event.target.value),
                                  packages: Array.from(
                                    { length: Math.max(Number(event.target.value) || 1, 1) },
                                    (_, index) =>
                                      current.packages[index] ?? {
                                        shippedSdCardsCount: 0,
                                        shippedDevicesCount: 0,
                                        shippedUsbHubsCount: 0,
                                        shippedCablesCount: 0,
                                        note: "",
                                      },
                                  ),
                                }))
                              }
                              placeholder="Number of QR labels"
                              className="border border-[color:var(--border)] bg-white px-3 py-2.5 text-sm text-[color:var(--foreground)] outline-none focus:border-[color:var(--accent)]"
                            />
                            <div className="border border-[color:var(--border)] bg-white px-3 py-2.5 text-xs uppercase tracking-[0.14em] text-[color:var(--muted-foreground)]">
                              Per-label shipped counts
                            </div>
                          </div>
                            <div className="grid gap-3">
                              {packageDraft.packages.map((entry, index) => (
                                <div
                                  key={`label-${index}`}
                                  className="grid gap-3 border border-[color:var(--border)] bg-white/78 p-3"
                                >
                                <div className="grid gap-3 sm:grid-cols-2 2xl:grid-cols-4">
                                  <input
                                    type="number"
                                    min={0}
                                    value={entry.shippedSdCardsCount || ""}
                                    onChange={(event) =>
                                      setPackageDraft((current) => ({
                                        ...current,
                                        packages: current.packages.map((pkg, packageIndex) =>
                                          packageIndex === index
                                            ? {
                                                ...pkg,
                                                shippedSdCardsCount: Number(event.target.value),
                                              }
                                            : pkg,
                                        ),
                                      }))
                                    }
                                    placeholder="Shipped SD cards"
                                    className="border border-[color:var(--border)] bg-white px-3 py-2.5 text-sm text-[color:var(--foreground)] outline-none focus:border-[color:var(--accent)]"
                                  />
                                  <input
                                    type="number"
                                    min={0}
                                    value={entry.shippedDevicesCount || ""}
                                    onChange={(event) =>
                                      setPackageDraft((current) => ({
                                        ...current,
                                        packages: current.packages.map((pkg, packageIndex) =>
                                          packageIndex === index
                                            ? {
                                                ...pkg,
                                                shippedDevicesCount: Number(event.target.value),
                                              }
                                            : pkg,
                                        ),
                                      }))
                                    }
                                    placeholder="Shipped devices"
                                    className="border border-[color:var(--border)] bg-white px-3 py-2.5 text-sm text-[color:var(--foreground)] outline-none focus:border-[color:var(--accent)]"
                                  />
                                  <input
                                    type="number"
                                    min={0}
                                    value={entry.shippedUsbHubsCount || ""}
                                    onChange={(event) =>
                                      setPackageDraft((current) => ({
                                        ...current,
                                        packages: current.packages.map((pkg, packageIndex) =>
                                          packageIndex === index
                                            ? {
                                                ...pkg,
                                                shippedUsbHubsCount: Number(event.target.value),
                                              }
                                            : pkg,
                                        ),
                                      }))
                                    }
                                    placeholder="Shipped USB hubs"
                                    className="border border-[color:var(--border)] bg-white px-3 py-2.5 text-sm text-[color:var(--foreground)] outline-none focus:border-[color:var(--accent)]"
                                  />
                                  <input
                                    type="number"
                                    min={0}
                                    value={entry.shippedCablesCount || ""}
                                    onChange={(event) =>
                                      setPackageDraft((current) => ({
                                        ...current,
                                        packages: current.packages.map((pkg, packageIndex) =>
                                          packageIndex === index
                                            ? {
                                                ...pkg,
                                                shippedCablesCount: Number(event.target.value),
                                              }
                                            : pkg,
                                        ),
                                      }))
                                    }
                                    placeholder="Shipped cables"
                                    className="border border-[color:var(--border)] bg-white px-3 py-2.5 text-sm text-[color:var(--foreground)] outline-none focus:border-[color:var(--accent)]"
                                  />
                                </div>
                                <input
                                  value={entry.note}
                                  onChange={(event) =>
                                    setPackageDraft((current) => ({
                                      ...current,
                                      packages: current.packages.map((pkg, packageIndex) =>
                                        packageIndex === index
                                          ? { ...pkg, note: event.target.value }
                                          : pkg,
                                      ),
                                    }))
                                  }
                                  placeholder={`Label ${index + 1} note`}
                                  className="border border-[color:var(--border)] bg-white px-3 py-2.5 text-sm text-[color:var(--foreground)] outline-none focus:border-[color:var(--accent)]"
                                />
                              </div>
                            ))}
                          </div>
                          <div className="flex items-center justify-end gap-3">
                            <button
                              type="button"
                              onClick={() => void handleCreatePackage()}
                              disabled={packageCreatePending || !selectedTicket}
                              className="border border-[color:var(--foreground)] bg-[color:var(--foreground)] px-4 py-2 text-sm font-semibold text-white disabled:opacity-60"
                            >
                              {packageCreatePending ? "Generating..." : "Generate QR Labels"}
                            </button>
                          </div>
                          {packageCreateFeedback ? (
                            <p className="text-sm text-[color:var(--muted-foreground)]">
                              {packageCreateFeedback}
                            </p>
                          ) : null}
                        </div>
                      ) : null}

                      <label className="grid gap-2 text-sm text-[color:var(--muted-foreground)]">
                        QR lookup
                        <div className="flex flex-col gap-2 sm:flex-row">
                          <input
                            value={qrLookup}
                            onChange={(event) => setQrLookup(event.target.value)}
                            placeholder="Paste or scan QR token"
                            className="flex-1 border border-[color:var(--border)] bg-white px-3 py-2.5 text-[color:var(--foreground)] outline-none focus:border-[color:var(--accent)]"
                          />
                          <button
                            type="button"
                            onClick={() => void handleLoadQrDetail()}
                            disabled={!canViewPackages || qrPending || !qrLookup.trim()}
                            className="border border-[color:var(--foreground)] bg-white px-4 py-2 text-sm font-semibold text-[color:var(--foreground)] disabled:opacity-60 sm:self-start"
                          >
                            {qrPending ? "Loading..." : "Open"}
                          </button>
                        </div>
                      </label>

                      {selectedTicket.packages.map((pkg) => (
                        <PackageCard
                          key={pkg.packageCode}
                          pkg={pkg}
                          canEditQr={canEditPackages}
                          canUpdateStatus={canUpdatePackageStatus}
                          availableActions={transitionMap[pkg.status].filter((status) =>
                            roleStatusTargets[viewer.role].includes(status),
                          )}
                          onSelectQr={(entry) => {
                            setQrLookup(entry.qrToken);
                            void handleLoadQrDetail(entry.qrToken);
                          }}
                          onUpdateStatus={(entry, nextStatus) =>
                            void handlePackageStatusAction(entry, nextStatus)
                          }
                          pending={packagePending}
                        />
                      ))}

                      <label className="grid gap-2 text-sm text-[color:var(--muted-foreground)]">
                        Packet lifecycle note
                        <textarea
                          value={packageActionNote}
                          onChange={(event) => setPackageActionNote(event.target.value)}
                          rows={3}
                          disabled={!canUpdatePackageStatus || packagePending}
                          className="border border-[color:var(--border)] bg-white px-3 py-2.5 text-[color:var(--foreground)] outline-none focus:border-[color:var(--accent)] disabled:opacity-60"
                          placeholder="Add a note before moving a specific packet"
                        />
                      </label>
                      {packageFeedback ? (
                        <p className="text-sm text-[color:var(--muted-foreground)]">
                          {packageFeedback}
                        </p>
                      ) : null}

                      {qrDetail ? (
                        <div className="grid gap-4 border border-[color:var(--border)] bg-white/78 p-4 lg:grid-cols-[0.9fr_1.1fr]">
                          <div className="space-y-3">
                            <p className="font-mono text-[11px] uppercase tracking-[0.16em] text-[color:var(--muted-foreground)]">
                              QR detail
                            </p>
                            {qrDetail.qrSvgPath ? (
                              <div className="border border-[color:var(--border)] bg-[color:var(--muted)] p-4">
                                <Image
                                  src={qrSvgUrl(qrDetail.package.qrToken)}
                                  alt={`${qrDetail.package.packageCode} QR`}
                                  width={192}
                                  height={192}
                                  className="mx-auto h-48 w-48"
                                  unoptimized
                                />
                              </div>
                            ) : null}
                            <div className="border border-[color:var(--border)] bg-[color:var(--muted)] p-4 text-sm">
                              <p className="font-semibold text-[color:var(--foreground)]">
                                {qrDetail.package.packageCode}
                              </p>
                              <p className="mt-2 break-all font-mono text-[11px] uppercase tracking-[0.14em] text-[color:var(--muted-foreground)]">
                                {qrDetail.package.qrToken}
                              </p>
                              <p className="mt-3 text-[color:var(--muted-foreground)]">
                                Scan URL: {qrDetail.scanUrl}
                              </p>
                              <a
                                href={qrDetail.scanUrl}
                                target="_blank"
                                rel="noreferrer"
                                className="mt-3 inline-flex border border-[color:var(--border)] bg-white px-3 py-2 text-xs font-semibold uppercase tracking-[0.14em] text-[color:var(--foreground)]"
                              >
                                Open public page
                              </a>
                            </div>
                          </div>

                          <div className="grid gap-3">
                            <div className="grid gap-3 sm:grid-cols-2">
                              <div className="border border-[color:var(--border)] bg-[color:var(--muted)] p-4 text-sm">
                                <p className="text-[11px] uppercase tracking-[0.16em] text-[color:var(--muted-foreground)]">
                                  Logistics packed
                                </p>
                                <dl className="mt-3 grid gap-2 text-[color:var(--muted-foreground)]">
                                  <div className="flex items-center justify-between gap-3">
                                    <dt>SD cards</dt>
                                    <dd className="font-medium text-[color:var(--foreground)]">
                                      {qrDetail.package.shippedSdCardsCount}
                                    </dd>
                                  </div>
                                  <div className="flex items-center justify-between gap-3">
                                    <dt>Devices</dt>
                                    <dd className="font-medium text-[color:var(--foreground)]">
                                      {qrDetail.package.shippedDevicesCount}
                                    </dd>
                                  </div>
                                  <div className="flex items-center justify-between gap-3">
                                    <dt>USB hubs</dt>
                                    <dd className="font-medium text-[color:var(--foreground)]">
                                      {qrDetail.package.shippedUsbHubsCount}
                                    </dd>
                                  </div>
                                  <div className="flex items-center justify-between gap-3">
                                    <dt>Cables</dt>
                                    <dd className="font-medium text-[color:var(--foreground)]">
                                      {qrDetail.package.shippedCablesCount}
                                    </dd>
                                  </div>
                                </dl>
                              </div>
                              <div className="border border-[color:var(--border)] bg-[color:var(--muted)] p-4 text-sm">
                                <p className="text-[11px] uppercase tracking-[0.16em] text-[color:var(--muted-foreground)]">
                                  Factory confirmed received
                                </p>
                                <dl className="mt-3 grid gap-2 text-[color:var(--muted-foreground)]">
                                  <div className="flex items-center justify-between gap-3">
                                    <dt>SD cards</dt>
                                    <dd className="font-medium text-[color:var(--foreground)]">
                                      {qrDetail.package.receivedSdCardsCount ?? "-"}
                                    </dd>
                                  </div>
                                  <div className="flex items-center justify-between gap-3">
                                    <dt>Devices</dt>
                                    <dd className="font-medium text-[color:var(--foreground)]">
                                      {qrDetail.package.receivedDevicesCount ?? "-"}
                                    </dd>
                                  </div>
                                  <div className="flex items-center justify-between gap-3">
                                    <dt>USB hubs</dt>
                                    <dd className="font-medium text-[color:var(--foreground)]">
                                      {qrDetail.package.receivedUsbHubsCount ?? "-"}
                                    </dd>
                                  </div>
                                  <div className="flex items-center justify-between gap-3">
                                    <dt>Cables</dt>
                                    <dd className="font-medium text-[color:var(--foreground)]">
                                      {qrDetail.package.receivedCablesCount ?? "-"}
                                    </dd>
                                  </div>
                                </dl>
                              </div>
                            </div>
                            <div className="grid gap-3 sm:grid-cols-2">
                              <input
                                value={qrDraft.teamName ?? qrDetail.teamName}
                                onChange={(event) =>
                                  setQrDraft((current) => ({
                                    ...current,
                                    teamName: event.target.value,
                                  }))
                                }
                                disabled={!qrDetail.editable || qrPending}
                                placeholder="Team name"
                                className="border border-[color:var(--border)] bg-white px-3 py-2.5 text-sm text-[color:var(--foreground)] outline-none focus:border-[color:var(--accent)] disabled:opacity-60"
                              />
                              <input
                                value={qrDraft.factoryName ?? qrDetail.factoryName}
                                onChange={(event) =>
                                  setQrDraft((current) => ({
                                    ...current,
                                    factoryName: event.target.value,
                                  }))
                                }
                                disabled={!qrDetail.editable || qrPending}
                                placeholder="Factory name"
                                className="border border-[color:var(--border)] bg-white px-3 py-2.5 text-sm text-[color:var(--foreground)] outline-none focus:border-[color:var(--accent)] disabled:opacity-60"
                              />
                              <input
                                type="date"
                                value={qrDraft.deploymentDate ?? qrDetail.deploymentDate}
                                onChange={(event) =>
                                  setQrDraft((current) => ({
                                    ...current,
                                    deploymentDate: event.target.value,
                                  }))
                                }
                                disabled={!qrDetail.editable || qrPending}
                                className="border border-[color:var(--border)] bg-white px-3 py-2.5 text-sm text-[color:var(--foreground)] outline-none focus:border-[color:var(--accent)] disabled:opacity-60"
                              />
                              <input
                                type="number"
                                value={
                                  qrDraft.receivedSdCardsCount ??
                                  qrDetail.package.receivedSdCardsCount ??
                                  qrDetail.package.shippedSdCardsCount
                                }
                                onChange={(event) =>
                                  setQrDraft((current) => ({
                                    ...current,
                                    receivedSdCardsCount: Number(event.target.value),
                                  }))
                                }
                                disabled={!qrDetail.editable || qrPending}
                                placeholder="Received SD card count"
                                className="border border-[color:var(--border)] bg-white px-3 py-2.5 text-sm text-[color:var(--foreground)] outline-none focus:border-[color:var(--accent)] disabled:opacity-60"
                              />
                              <input
                                type="number"
                                value={
                                  qrDraft.receivedDevicesCount ??
                                  qrDetail.package.receivedDevicesCount ??
                                  qrDetail.package.shippedDevicesCount
                                }
                                onChange={(event) =>
                                  setQrDraft((current) => ({
                                    ...current,
                                    receivedDevicesCount: Number(event.target.value),
                                  }))
                                }
                                disabled={!qrDetail.editable || qrPending}
                                placeholder="Received devices"
                                className="border border-[color:var(--border)] bg-white px-3 py-2.5 text-sm text-[color:var(--foreground)] outline-none focus:border-[color:var(--accent)] disabled:opacity-60"
                              />
                              <input
                                type="number"
                                value={
                                  qrDraft.receivedUsbHubsCount ??
                                  qrDetail.package.receivedUsbHubsCount ??
                                  qrDetail.package.shippedUsbHubsCount
                                }
                                onChange={(event) =>
                                  setQrDraft((current) => ({
                                    ...current,
                                    receivedUsbHubsCount: Number(event.target.value),
                                  }))
                                }
                                disabled={!qrDetail.editable || qrPending}
                                placeholder="Received USB hubs"
                                className="border border-[color:var(--border)] bg-white px-3 py-2.5 text-sm text-[color:var(--foreground)] outline-none focus:border-[color:var(--accent)] disabled:opacity-60"
                              />
                              <input
                                type="number"
                                value={
                                  qrDraft.receivedCablesCount ??
                                  qrDetail.package.receivedCablesCount ??
                                  qrDetail.package.shippedCablesCount
                                }
                                onChange={(event) =>
                                  setQrDraft((current) => ({
                                    ...current,
                                    receivedCablesCount: Number(event.target.value),
                                  }))
                                }
                                disabled={!qrDetail.editable || qrPending}
                                placeholder="Received cables"
                                className="border border-[color:var(--border)] bg-white px-3 py-2.5 text-sm text-[color:var(--foreground)] outline-none focus:border-[color:var(--accent)] disabled:opacity-60"
                              />
                            </div>
                            <textarea
                              value={qrDraft.note ?? qrDetail.package.note}
                              onChange={(event) =>
                                setQrDraft((current) => ({
                                  ...current,
                                  note: event.target.value,
                                }))
                              }
                              rows={4}
                              disabled={!qrDetail.editable || qrPending}
                              className="border border-[color:var(--border)] bg-white px-3 py-2.5 text-[color:var(--foreground)] outline-none focus:border-[color:var(--accent)] disabled:opacity-60"
                            />
                            <div className="flex items-center justify-between gap-3">
                              <div className="space-y-1 text-xs uppercase tracking-[0.14em] text-[color:var(--muted-foreground)]">
                                <p>
                                  {qrDetail.editable
                                    ? viewer.role === "admin" && qrDetail.lockedReason
                                      ? "Public edit window closed. Admin override is active."
                                      : "Public edit window is open for this QR label."
                                    : qrDetail.lockedReason ?? "Public edit window is closed."}
                                </p>
                                {qrDetail.editWindowExpiresAt ? (
                                  <p>Editable until {formatDateTime(qrDetail.editWindowExpiresAt)}</p>
                                ) : (
                                  <p>Window starts on the first successful save.</p>
                                )}
                              </div>
                              <button
                                type="button"
                                onClick={() => void handleSaveQrDetail()}
                                disabled={!qrDetail.editable || qrPending}
                                className="border border-[color:var(--foreground)] bg-[color:var(--foreground)] px-4 py-2 text-sm font-semibold text-white disabled:opacity-60"
                              >
                                {qrPending ? "Saving..." : "Save QR Detail"}
                              </button>
                            </div>
                            {qrFeedback ? (
                              <p className="text-sm text-[color:var(--muted-foreground)]">
                                {qrFeedback}
                              </p>
                            ) : null}
                          </div>
                        </div>
                      ) : null}
                    </div>
                  </section>

                  <section className="panel-shell overflow-hidden">
                    <PanelHeader
                      eyebrow="Ingestion"
                      title="Reconciliation"
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

                      {canReconcileIngestion ? (
                        <div className="grid gap-3 border border-[color:var(--border)] bg-[color:var(--muted)] p-4">
                          <div className="flex items-center justify-between gap-3">
                            <div>
                              <p className="font-mono text-[11px] uppercase tracking-[0.16em] text-[color:var(--muted-foreground)]">
                                Reconciliation form
                              </p>
                              <h3 className="mt-1 text-base font-semibold text-[color:var(--foreground)]">
                                Record ingestion counts
                              </h3>
                            </div>
                            <span className="text-xs uppercase tracking-[0.14em] text-[color:var(--muted-foreground)]">
                              {viewerRoleLabel(viewer.role)}
                            </span>
                          </div>
                          <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-3">
                            <input
                              value={reconciliationDraft.station}
                              onChange={(event) =>
                                setReconciliationDraft((current) => ({
                                  ...current,
                                  station: event.target.value,
                                }))
                              }
                              placeholder="Station"
                              className="border border-[color:var(--border)] bg-white px-3 py-2.5 text-sm text-[color:var(--foreground)] outline-none focus:border-[color:var(--accent)]"
                            />
                            <input
                              type="number"
                              value={reconciliationDraft.expectedSdCards || ""}
                              onChange={(event) =>
                                setReconciliationDraft((current) => ({
                                  ...current,
                                  expectedSdCards: Number(event.target.value),
                                }))
                              }
                              placeholder="Expected"
                              className="border border-[color:var(--border)] bg-white px-3 py-2.5 text-sm text-[color:var(--foreground)] outline-none focus:border-[color:var(--accent)]"
                            />
                            <input
                              type="number"
                              value={reconciliationDraft.actualSdCardsReceived || ""}
                              onChange={(event) =>
                                setReconciliationDraft((current) => ({
                                  ...current,
                                  actualSdCardsReceived: Number(event.target.value),
                                  missingSdCards: Math.max(
                                    current.expectedSdCards - Number(event.target.value),
                                    0,
                                  ),
                                }))
                              }
                              placeholder="Received"
                              className="border border-[color:var(--border)] bg-white px-3 py-2.5 text-sm text-[color:var(--foreground)] outline-none focus:border-[color:var(--accent)]"
                            />
                            <input
                              type="number"
                              value={reconciliationDraft.processedSdCards || ""}
                              onChange={(event) =>
                                setReconciliationDraft((current) => ({
                                  ...current,
                                  processedSdCards: Number(event.target.value),
                                }))
                              }
                              placeholder="Processed"
                              className="border border-[color:var(--border)] bg-white px-3 py-2.5 text-sm text-[color:var(--foreground)] outline-none focus:border-[color:var(--accent)]"
                            />
                            <input
                              type="number"
                              value={reconciliationDraft.missingSdCards || ""}
                              onChange={(event) =>
                                setReconciliationDraft((current) => ({
                                  ...current,
                                  missingSdCards: Number(event.target.value),
                                }))
                              }
                              placeholder="Missing"
                              className="border border-[color:var(--border)] bg-white px-3 py-2.5 text-sm text-[color:var(--foreground)] outline-none focus:border-[color:var(--accent)]"
                            />
                            <input
                              type="number"
                              value={reconciliationDraft.faultySdCards || ""}
                              onChange={(event) =>
                                setReconciliationDraft((current) => ({
                                  ...current,
                                  faultySdCards: Number(event.target.value),
                                }))
                              }
                              placeholder="Faulty"
                              className="border border-[color:var(--border)] bg-white px-3 py-2.5 text-sm text-[color:var(--foreground)] outline-none focus:border-[color:var(--accent)]"
                            />
                          </div>
                          <textarea
                            value={reconciliationDraft.note}
                            onChange={(event) =>
                              setReconciliationDraft((current) => ({
                                ...current,
                                note: event.target.value,
                              }))
                            }
                            rows={4}
                            placeholder="Counts summary and red-mark note"
                            className="border border-[color:var(--border)] bg-white px-3 py-2.5 text-[color:var(--foreground)] outline-none focus:border-[color:var(--accent)]"
                          />
                          <label className="flex items-center gap-3 text-sm text-[color:var(--foreground)]">
                            <input
                              type="checkbox"
                              checked={Boolean(reconciliationDraft.markCompleted)}
                              onChange={(event) =>
                                setReconciliationDraft((current) => ({
                                  ...current,
                                  markCompleted: event.target.checked,
                                }))
                              }
                            />
                            Mark ingestion completed after saving
                          </label>
                          <div className="flex items-center justify-between gap-3">
                            <span className="text-xs uppercase tracking-[0.14em] text-[color:var(--muted-foreground)]">
                              Missing should equal expected minus received.
                            </span>
                            <button
                              type="button"
                              onClick={() => void handleSaveReconciliation()}
                              disabled={
                                reconciliationPending ||
                                !reconciliationDraft.station.trim() ||
                                !reconciliationDraft.note.trim()
                              }
                              className="border border-[color:var(--foreground)] bg-[color:var(--foreground)] px-4 py-2 text-sm font-semibold text-white disabled:opacity-60"
                            >
                              {reconciliationPending ? "Saving..." : "Save Counts"}
                            </button>
                          </div>
                          {reconciliationFeedback ? (
                            <p className="text-sm text-[color:var(--muted-foreground)]">
                              {reconciliationFeedback}
                            </p>
                          ) : null}
                        </div>
                      ) : null}
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

        {viewer.role === "admin" || viewer.role === "logistics" ? (
          <MovementLedgerPanel movements={currentSnapshot.movementHistory} />
        ) : null}

        <section className="grid gap-4 xl:grid-cols-2">
          <RoleMatrixPanel
            viewerRole={currentSnapshot.viewer.role}
            roleMatrix={currentSnapshot.roleMatrix}
          />
          {viewer.role !== "factory_operator" ? (
            <MeritPanel scores={currentSnapshot.meritScores} />
          ) : null}
        </section>

        <section className="panel-shell overflow-hidden">
          <PanelHeader
            eyebrow="Ingestion Room"
            title="Packets visible to ingestion"
          />
          <div className="grid gap-4 p-5 md:grid-cols-2 2xl:grid-cols-3">
            {currentSnapshot.ingestionQueue.map((packet) => (
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

        {viewer.permissions.includes("inventory.view") ? (
          <AdminInventoryPanel
            initialItems={currentSnapshot.inventoryItems}
            health={health}
            session={session}
          />
        ) : null}
      </div>
    </main>
  );
}
