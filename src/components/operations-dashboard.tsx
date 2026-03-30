"use client";

import Image from "next/image";
import Link from "next/link";
import {
  startTransition,
  useDeferredValue,
  useEffect,
  useEffectEvent,
  useRef,
  useState,
} from "react";
import { AdminInventoryPanel } from "@/components/admin-inventory-panel";
import type { AppWorkspace } from "@/components/operations-app";
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

const PUBLIC_SITE_URL =
  process.env.NEXT_PUBLIC_SITE_URL?.replace(/\/+$/, "") ?? "https://buildai-dlc.vercel.app";

type WorkspaceId = AppWorkspace;
type DetailPanelId = "tracking" | "actions" | "packets";

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
      className={`inline-flex items-center rounded-md border px-2 py-0.5 text-[10px] font-medium uppercase tracking-wider ${toneClass(tone)} transition-all duration-200`}
    >
      <span className="mr-1.5 h-1.5 w-1.5 rounded-full bg-current opacity-75" />
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
      className={`inline-flex items-center rounded-md border px-1.5 py-0.5 text-[9px] font-bold uppercase tracking-widest ${toneClass(tone)}`}
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

function WorkspaceNavIcon({ workspace }: { workspace: WorkspaceId }) {
  const className = "h-[18px] w-[18px]";

  switch (workspace) {
    case "home":
      return (
        <svg className={className} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8">
          <path d="M3 10.5 12 3l9 7.5" />
          <path d="M5.25 9.75V21h13.5V9.75" />
        </svg>
      );
    case "tickets":
      return (
        <svg className={className} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8">
          <path d="M4 6.75A1.75 1.75 0 0 1 5.75 5h12.5A1.75 1.75 0 0 1 20 6.75v10.5A1.75 1.75 0 0 1 18.25 19H5.75A1.75 1.75 0 0 1 4 17.25Z" />
          <path d="M7.5 9h9M7.5 12h9M7.5 15h5.5" />
        </svg>
      );
    case "ingestion":
      return (
        <svg className={className} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8">
          <path d="M12 3v18M7 8l5-5 5 5M7 16l5 5 5-5" />
        </svg>
      );
    case "movement":
      return (
        <svg className={className} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8">
          <path d="M4 7h10m0 0-3-3m3 3-3 3M20 17H10m0 0 3-3m-3 3 3 3" />
        </svg>
      );
    case "merit":
      return (
        <svg className={className} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8">
          <path d="M12 4 14.47 9l5.53.8-4 3.9.94 5.5L12 16.6 7.06 19.2 8 13.7 4 9.8 9.53 9Z" />
        </svg>
      );
    case "inventory":
      return (
        <svg className={className} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8">
          <path d="M4.5 7.5 12 3l7.5 4.5V18L12 21l-7.5-3Z" />
          <path d="M4.5 7.5 12 12l7.5-4.5M12 12v9" />
        </svg>
      );
  }
}

function replyExcerpt(message: string) {
  return message.replace(/\s+/g, " ").trim().slice(0, 160);
}

function latestTicketTimestamp(ticket: TicketRecord) {
  const timelineTimes = ticket.timeline.map((event) => Date.parse(event.occurredAt));
  const messageTimes = ticket.messages.map((message) => Date.parse(message.sentAt));
  const deploymentTime = Date.parse(ticket.deploymentDate);
  return Math.max(
    0,
    Number.isNaN(deploymentTime) ? 0 : deploymentTime,
    ...timelineTimes.filter((value) => !Number.isNaN(value)),
    ...messageTimes.filter((value) => !Number.isNaN(value)),
  );
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
  if (
    draft.shippedSdCardsCount < 0 ||
    draft.shippedDevicesCount < 0 ||
    draft.shippedUsbHubsCount < 0 ||
    draft.shippedCablesCount < 0
  ) {
    return "Enter valid shipped quantities for the QR batch.";
  }
  if (!draft.note.trim()) {
    return "Add the shared QR label note.";
  }

  const totalForLabel =
    draft.shippedSdCardsCount +
    draft.shippedDevicesCount +
    draft.shippedUsbHubsCount +
    draft.shippedCablesCount;
  if (totalForLabel <= 0) {
    return "Enter at least one shipped item count for the QR batch.";
  }

  if (ticket.sdCardsRequested > 0 && draft.shippedSdCardsCount <= 0) {
    return "Enter the shipped SD card count for at least one QR label.";
  }
  if (ticket.devicesRequested > 0 && draft.shippedDevicesCount <= 0) {
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
    <div className="flex flex-col gap-1.5 border-b border-[color:var(--border)] bg-[color:var(--card)]/50 px-6 py-5 backdrop-blur-sm">
      <span className="font-mono text-[9px] font-bold uppercase tracking-[0.3em] text-[color:var(--muted-foreground)]">
        {eyebrow}
      </span>
      <div className="space-y-1">
        <h2 className="font-display text-lg font-bold tracking-tight text-[color:var(--foreground)]">
          {title}
        </h2>
        {helper ? (
          <p className="max-w-2xl text-xs leading-relaxed text-[color:var(--muted-foreground)]">
            {helper}
          </p>
        ) : null}
      </div>
    </div>
  );
}

function ItemTable({ items }: { items: RequestItem[] }) {
  return (
    <div className="overflow-x-auto rounded-3xl border border-[color:var(--border)]">
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
              className="border-t border-[color:var(--border)] bg-[color:var(--card)]"
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
    <article className="rounded-3xl border border-[color:var(--border)] bg-[color:var(--card)] p-4">
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
            Packet
          </dt>
          <dd className="mt-1 font-medium text-[color:var(--foreground)]">
            {pkg.packageCode}
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
          className="rounded-full border border-[color:var(--border)] bg-[color:var(--secondary)] px-3 py-2 text-xs font-semibold uppercase tracking-[0.14em] text-[color:var(--foreground)]"
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
                className="rounded-full border border-[color:var(--border)] bg-[color:var(--secondary)] px-3 py-2 text-xs font-semibold uppercase tracking-[0.14em] text-[color:var(--foreground)] disabled:opacity-60"
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
    <div className="rounded-[28px] border border-[color:var(--border)] bg-[color:var(--card)] p-4 sm:p-5">
      <div className="flex items-center justify-between gap-4">
        <div>
          <p className="font-mono text-[11px] font-semibold uppercase tracking-[0.22em] text-[color:var(--muted-foreground)]">
            Team merit
          </p>
          <h2 className="mt-2 text-lg font-semibold tracking-[-0.03em] text-[color:var(--foreground)]">
            Return discipline scoreboard
          </h2>
        </div>
        <span className="rounded-full border border-[color:var(--border)] bg-[color:var(--secondary)] px-3 py-1 text-[11px] font-semibold uppercase tracking-[0.16em] text-[color:var(--foreground)]">
          SD 50 / Devices 25 / Accessories 25
        </span>
      </div>
      <div className="mt-5 grid gap-3 lg:grid-cols-2">
        {scores.map((score) => (
          <article key={score.teamName} className="rounded-3xl border border-[color:var(--border)] bg-[color:var(--muted)] p-3">
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
            className="rounded-3xl border border-[color:var(--border)] bg-[color:var(--card)] p-4"
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
  workspace,
  snapshot,
  health,
  session,
  onSessionChange,
  onLogout,
}: {
  workspace: WorkspaceId;
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
    shippedSdCardsCount: 0,
    shippedDevicesCount: 0,
    shippedUsbHubsCount: 0,
    shippedCablesCount: 0,
    note: "",
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
  const [streamRetryKey, setStreamRetryKey] = useState(0);
  const [replyTarget, setReplyTarget] = useState<ChatMessage | null>(null);
  const [activeSwipeMessageId, setActiveSwipeMessageId] = useState<string | null>(null);
  const [activeSwipeOffset, setActiveSwipeOffset] = useState(0);
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
  const [detailPanel, setDetailPanel] = useState<DetailPanelId>("tracking");
  const [showCreateTicketForm, setShowCreateTicketForm] = useState(false);
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
  const chatListRef = useRef<HTMLDivElement | null>(null);
  const messageComposerRef = useRef<HTMLTextAreaElement | null>(null);
  const reconnectTimerRef = useRef<number | null>(null);
  const swipeStartXRef = useRef(0);
  const openTicketCount = currentSnapshot.tickets.filter(
    (ticket) => ticket.status !== "closed" && ticket.status !== "rejected",
  ).length;
  const packetCount = currentSnapshot.tickets.reduce(
    (total, ticket) => total + ticket.packages.length,
    0,
  );
  const activeMeritAlertCount = currentSnapshot.meritScores.filter((score) => score.score < 95).length;
  const recentTickets = [...currentSnapshot.tickets]
    .sort((left, right) => latestTicketTimestamp(right) - latestTicketTimestamp(left))
    .slice(0, 6);

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
  const orderedTickets = [...filteredTickets].sort(
    (left, right) => latestTicketTimestamp(right) - latestTicketTimestamp(left),
  );
  const selectedTicket =
    orderedTickets.find((ticket) => ticket.id === selectedTicketId) ?? orderedTickets[0];
  const orderedMessages = selectedTicket
    ? [...selectedTicket.messages].sort(
        (left, right) => Date.parse(left.sentAt) - Date.parse(right.sentAt),
      )
    : [];
  const activeTicketId = selectedTicket?.id ?? null;
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
        setStreamStatus(event.eventType === "ticket.message" ? "Live sync connected" : `Live sync: ${event.eventType}`);
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
    if (orderedTickets.some((ticket) => ticket.id === selectedTicketId)) {
      return;
    }

    if (!orderedTickets[0]) {
      return;
    }

    startTransition(() => {
      setSelectedTicketId(orderedTickets[0].id);
    });
  }, [orderedTickets, selectedTicketId]);

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
    if (!activeTicketId || !session.token) {
      return;
    }

    let closedByCleanup = false;
    const socket = openTicketStream(activeTicketId, session, handleStreamEvent);

    if (!socket) {
      return;
    }

    setStreamStatus("Live sync connecting");
    socket.onopen = () => setStreamStatus("Live sync connected");
    socket.onerror = () => setStreamStatus("Live sync error");
    socket.onclose = () => {
      if (closedByCleanup) {
        return;
      }
      setStreamStatus("Live sync reconnecting");
      reconnectTimerRef.current = window.setTimeout(() => {
        setStreamRetryKey((current) => current + 1);
      }, 1500);
    };

    const interval = window.setInterval(() => {
      if (socket.readyState === window.WebSocket.OPEN) {
        socket.send("ping");
      }
    }, 15000);

    return () => {
      closedByCleanup = true;
      if (reconnectTimerRef.current) {
        window.clearTimeout(reconnectTimerRef.current);
        reconnectTimerRef.current = null;
      }
      window.clearInterval(interval);
      socket.close();
    };
  }, [activeTicketId, session, streamRetryKey]);

  useEffect(() => {
    setReplyTarget(null);
    setActiveSwipeMessageId(null);
    setActiveSwipeOffset(0);
    setDetailPanel("tracking");
  }, [selectedTicket?.id]);

  useEffect(() => {
    if (!chatListRef.current) {
      return;
    }
    chatListRef.current.scrollTop = chatListRef.current.scrollHeight;
  }, [selectedTicket?.messages.length]);

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
  const canViewInventory = viewer.permissions.includes("inventory.view");
  const canViewMovement = viewer.role === "admin" || viewer.role === "logistics";
  const canViewMerit = viewer.role !== "factory_operator";
  const availableStatusActions =
    selectedTicket && canUpdateStatus
      ? transitionMap[selectedTicket.status].filter((status) =>
          roleStatusTargets[viewer.role].includes(status),
        )
      : [];
  const quickHeaderActions =
    selectedTicket?.status === "open"
      ? availableStatusActions.filter((status) => status === "accepted" || status === "rejected")
      : [];
  const sidebarStatusActions =
    selectedTicket?.status === "open"
      ? availableStatusActions.filter((status) => status !== "accepted" && status !== "rejected")
      : availableStatusActions;
  const workspaceItems = [
    { id: "home" as WorkspaceId, short: "HM", label: "Home", href: "/", count: 0, visible: true },
    {
      id: "tickets" as WorkspaceId,
      short: "TK",
      label: "Tickets",
      href: "/tickets",
      count: orderedTickets.length,
      visible: true,
    },
    {
      id: "ingestion" as WorkspaceId,
      short: "IG",
      label: "Ingestion",
      href: "/ingestion",
      count: currentSnapshot.ingestionQueue.length,
      visible: viewer.role === "ingestion" || viewer.role === "admin" || viewer.role === "logistics",
    },
    {
      id: "movement" as WorkspaceId,
      short: "MV",
      label: "Movement",
      href: "/movement",
      count: currentSnapshot.movementHistory.length,
      visible: canViewMovement,
    },
    {
      id: "merit" as WorkspaceId,
      short: "MR",
      label: "Merit",
      href: "/merit",
      count: activeMeritAlertCount,
      visible: canViewMerit,
    },
    {
      id: "inventory" as WorkspaceId,
      short: "IV",
      label: "Inventory",
      href: "/inventory",
      count: currentSnapshot.inventoryItems.length,
      visible: canViewInventory,
    },
  ].filter((workspace) => workspace.visible);
  const currentWorkspace = workspaceItems.find((item) => item.id === workspace) ?? workspaceItems[0];

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

  function beginReply(message: ChatMessage) {
    setReplyTarget(message);
    setActiveSwipeMessageId(null);
    setActiveSwipeOffset(0);
    messageComposerRef.current?.focus();
  }

  function clearReplyTarget() {
    setReplyTarget(null);
  }

  function beginSwipe(messageId: string, clientX: number) {
    swipeStartXRef.current = clientX;
    setActiveSwipeMessageId(messageId);
    setActiveSwipeOffset(0);
  }

  function moveSwipe(messageId: string, clientX: number) {
    if (activeSwipeMessageId !== messageId) {
      return;
    }
    const delta = clientX - swipeStartXRef.current;
    const bounded = Math.max(-88, Math.min(88, delta));
    setActiveSwipeOffset(bounded);
  }

  function endSwipe(message: ChatMessage) {
    if (activeSwipeMessageId !== message.id) {
      return;
    }
    if (Math.abs(activeSwipeOffset) >= 56) {
      beginReply(message);
    }
    setActiveSwipeMessageId(null);
    setActiveSwipeOffset(0);
  }

  function localQrDetail(pkg: PackageRecord): QrPackageDetail {
    const editWindowExpiresAt = pkg.editWindowExpiresAt ?? null;
    const editable =
      !editWindowExpiresAt || new Date(editWindowExpiresAt).getTime() >= Date.now();
    const scanBaseUrl =
      typeof window !== "undefined" ? window.location.origin : PUBLIC_SITE_URL;
    return {
      ticketId: selectedTicket?.id ?? "",
      title: selectedTicket?.title ?? "",
      teamName: pkg.teamName ?? selectedTicket?.teamName ?? "",
      factoryName: pkg.factoryName ?? selectedTicket?.factoryName ?? "",
      deploymentDate: pkg.deploymentDate ?? "",
      package: pkg,
      scanUrl: `${scanBaseUrl}/qr/${pkg.qrToken}`,
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
    const replyMetadata = replyTarget
      ? {
          replyToMessageId: replyTarget.id,
          replyToAuthor: replyTarget.author,
          replyToExcerpt: replyExcerpt(replyTarget.message),
        }
      : null;
    setMessagePending(true);
    setMessageFeedback("");

    try {
      const updated = await sendTicketMessage(
        selectedTicket.id,
        message,
        replyTarget?.id,
        session,
      );
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
              ...(replyMetadata ?? {}),
            },
          ],
        });
      }
      setMessageDraft("");
      setReplyTarget(null);
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
      setShowCreateTicketForm(false);
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
        const nextPackages: PackageRecord[] = Array.from(
          { length: packageDraft.labelCount },
          (_, index) => ({
            packageCode: `PKG-RET-${selectedTicket.id.slice(-4).toUpperCase()}${String.fromCharCode(65 + selectedTicket.packages.length + index)}`,
            qrToken: `qr_local_${Date.now()}_${index}`,
            direction: "return",
            status: selectedTicket.status,
            itemCount: 1,
            shippedSdCardsCount: packageDraft.shippedSdCardsCount,
            shippedDevicesCount: packageDraft.shippedDevicesCount,
            shippedUsbHubsCount: packageDraft.shippedUsbHubsCount,
            shippedCablesCount: packageDraft.shippedCablesCount,
            receivedSdCardsCount: null,
            receivedDevicesCount: null,
            receivedUsbHubsCount: null,
            receivedCablesCount: null,
            note: packageDraft.note,
            teamName: selectedTicket.teamName,
            factoryName: selectedTicket.factoryName,
            deploymentDate: null,
            updatedAt: new Date().toISOString(),
            updatedBy: viewer.name,
            firstEditAt: null,
            editWindowExpiresAt: null,
          }),
        );
        upsertTicket({
          ...selectedTicket,
          packages: [...selectedTicket.packages, ...nextPackages],
        });
      }
      setPackageCreateFeedback("QR labels generated.");
      setPackageDraft({
        labelCount: 1,
        shippedSdCardsCount: 0,
        shippedDevicesCount: 0,
        shippedUsbHubsCount: 0,
        shippedCablesCount: 0,
        note: "",
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
    <main className="min-h-screen bg-[color:var(--background)] text-[color:var(--foreground)] lg:h-screen">
      <div className="flex min-h-screen flex-col lg:h-screen">
        <header className="border-b border-[color:var(--border)] bg-[color:var(--card)]">
          <div className="flex flex-col gap-3 px-4 py-3 lg:flex-row lg:items-center lg:justify-between lg:px-6">
            <div className="flex items-center gap-4">
              <Link href="/" className="text-lg font-semibold tracking-[-0.03em] text-[color:var(--foreground)]">
                Build AI
              </Link>
              <span className="hidden text-[11px] uppercase tracking-[0.18em] text-[color:var(--muted-foreground)] lg:inline-flex">
                {viewerRoleLabel(session.user.role)}
              </span>
            </div>
            <nav className="flex gap-1 overflow-x-auto pb-1 lg:flex-1 lg:justify-center lg:pb-0">
              {workspaceItems.map((item) => {
                const active = item.id === currentWorkspace?.id;

                return (
                  <Link
                    key={item.id}
                    href={item.href}
                    className={`relative inline-flex items-center gap-2 rounded-xl border px-3 py-2 text-sm font-medium transition ${
                      active
                        ? "border-[color:var(--foreground)] bg-[color:var(--foreground)] text-white"
                        : "border-[color:var(--border)] bg-[color:var(--background)] text-[color:var(--muted-foreground)] hover:text-[color:var(--foreground)]"
                    }`}
                  >
                    <WorkspaceNavIcon workspace={item.id} />
                    <span>{item.label}</span>
                    {item.count > 0 ? (
                      <span className={`rounded-full px-1.5 py-0.5 font-mono text-[10px] ${
                        active ? "bg-white/15 text-white" : "bg-[color:var(--muted)] text-[color:var(--muted-foreground)]"
                      }`}>
                        {item.count > 99 ? "99+" : item.count}
                      </span>
                    ) : null}
                  </Link>
                );
              })}
            </nav>
            <div className="flex items-center justify-between gap-3 lg:justify-end">
              <div className="min-w-0">
                <p className="truncate text-sm font-semibold text-[color:var(--foreground)]">
                  {session.user.displayName}
                </p>
                <p className="truncate text-[11px] uppercase tracking-[0.16em] text-[color:var(--muted-foreground)]">
                  {session.user.email}
                </p>
              </div>
              <button
                type="button"
                onClick={onLogout}
                className="rounded-xl border border-[color:var(--border)] px-3 py-2 text-[11px] font-semibold uppercase tracking-[0.16em] text-[color:var(--foreground)]"
              >
                Sign Out
              </button>
            </div>
          </div>
        </header>

        <div className="min-h-0 flex-1">

          {workspace === "tickets" ? (
            <>
              <div className="grid h-full min-h-0 lg:grid-cols-[420px_minmax(0,1fr)]">
                <aside className="flex min-h-0 flex-col border-b border-[color:var(--border)] bg-[color:var(--card)] lg:border-b-0 lg:border-r">
                <div className="border-b border-[color:var(--border)] px-5 py-5">
                  <div className="flex items-start justify-between gap-3">
                    <div>
                      <h1 className="text-xl font-semibold tracking-[-0.03em] text-[color:var(--foreground)]">
                        Tickets
                      </h1>
                      <p className="mt-1 text-sm text-[color:var(--muted-foreground)]">
                        Track requests, shipments, and deployment ops.
                      </p>
                    </div>
                    {canCreateTicket ? (
                      <button
                        type="button"
                        onClick={() => setShowCreateTicketForm(true)}
                        className="rounded-full border border-[color:var(--foreground)] bg-[color:var(--foreground)] px-4 py-2 text-[11px] font-semibold uppercase tracking-[0.16em] text-white transition"
                      >
                        New Request
                      </button>
                    ) : null}
                  </div>

                  <div className="mt-4">
                    <input
                      value={query}
                      onChange={(event) => setQuery(event.target.value)}
                      placeholder="Search team, factory, or title"
                      className="w-full rounded-2xl border border-[color:var(--border)] bg-[color:var(--secondary)] px-4 py-3 text-sm text-[color:var(--foreground)] outline-none"
                    />
                  </div>
                  <div className="mt-3 flex gap-2 overflow-x-auto pb-1">
                    {statusOptions.map((option) => {
                      const active = statusFilter === option.value;

                      return (
                        <button
                          key={option.value}
                          type="button"
                          onClick={() => setStatusFilter(option.value)}
                          className={`whitespace-nowrap rounded-full border px-3 py-2 text-[11px] font-semibold uppercase tracking-[0.16em] ${
                            active
                              ? "border-[#00a884] bg-[color:var(--success-muted)] text-[color:var(--success-foreground)]"
                              : "border-[color:var(--border)] bg-[color:var(--card)] text-[color:var(--muted-foreground)]"
                          }`}
                        >
                          {option.label}
                        </button>
                      );
                    })}
                  </div>
                </div>

                <div className="min-h-0 flex-1 overflow-y-auto">
                  {orderedTickets.map((ticket) => {
                    const selected = ticket.id === selectedTicket?.id;
                    const latestActivityAt = latestTicketTimestamp(ticket);
                    const initials = ticket.teamName
                      .split(/\s+/)
                      .filter(Boolean)
                      .map((part) => part[0]?.toUpperCase() ?? "")
                      .join("")
                      .slice(0, 2);

                    return (
                      <button
                        key={ticket.id}
                        type="button"
                        onClick={() => setSelectedTicketId(ticket.id)}
                        className={`group relative flex w-full flex-col gap-2.5 border-b border-[color:var(--border)] px-5 py-4 text-left transition-all duration-200 ${
                          selected
                            ? "bg-[color:var(--secondary)]/70 ring-1 ring-inset ring-[color:var(--accent)]/10 text-[color:var(--foreground)]"
                            : "bg-[color:var(--card)] hover:bg-[color:var(--muted)]/50"
                        }`}
                      >
                        <div className="flex items-center justify-between gap-3">
                          <span className="font-mono text-[9px] font-bold uppercase tracking-[0.2em] text-[color:var(--muted-foreground)] group-hover:text-[color:var(--foreground)]">
                            {ticket.id.split("-")[0]}
                          </span>
                          <span className="text-[10px] font-medium text-[color:var(--muted-foreground)]">
                            {formatDateTime(new Date(latestActivityAt).toISOString())}
                          </span>
                        </div>

                        <div className="flex items-start gap-3.5">
                          <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl bg-[color:var(--accent-soft)] text-[11px] font-bold text-[color:var(--accent)] ring-1 ring-inset ring-[color:var(--accent)]/20 shadow-sm transition-transform group-hover:scale-105">
                            {initials}
                          </div>
                          <div className="min-w-0 flex-1">
                            <div className="flex flex-wrap items-center gap-1.5">
                              <h3 className="truncate font-display text-sm font-bold tracking-tight text-[color:var(--foreground)]">
                                {ticket.teamName}
                              </h3>
                              <TicketTypeBadge ticketType={ticket.ticketType} />
                            </div>
                            <p className="mt-0.5 truncate text-[11px] font-medium text-[color:var(--muted-foreground)]">
                              {ticket.factoryName}
                            </p>
                          </div>
                        </div>

                        <div className="mt-1 flex flex-wrap items-center gap-2">
                          <StatusBadge status={ticket.status} />
                          <div className="flex items-center gap-1.5 px-1 py-0.5 font-mono text-[10px] font-bold uppercase tracking-wider text-[color:var(--muted-foreground)] opacity-70">
                            <span>SD {ticket.sdCardsRequested}</span>
                            <span className="opacity-30">/</span>
                            <span>DV {ticket.devicesRequested}</span>
                          </div>
                        </div>
                      </button>
                    );
                  })}
                  {orderedTickets.length === 0 ? (
                    <div className="px-6 py-12 text-center">
                      <p className="text-xs font-medium text-[color:var(--muted-foreground)]">
                        No tickets match the current filter.
                      </p>
                    </div>
                  ) : null}
                </div>
              </aside>

              <section className="min-w-0 bg-[color:var(--background)]">
                {selectedTicket ? (
                  <div className="grid min-h-full lg:h-full lg:grid-cols-[minmax(0,1.55fr)_400px]">
                    <div className="flex min-h-0 flex-col lg:border-r lg:border-[color:var(--border)]">
                      <div className="border-b border-[color:var(--border)] bg-[color:var(--card)] px-4 py-4 lg:px-5">
                        <div className="flex flex-col gap-4 xl:flex-row xl:items-center xl:justify-between">
                          <div className="flex min-w-0 items-center gap-3">
                            <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-full bg-[color:var(--secondary)] text-sm font-semibold text-[color:var(--foreground)]">
                              {selectedTicket.teamName
                                .split(/\s+/)
                                .filter(Boolean)
                                .map((part) => part[0]?.toUpperCase() ?? "")
                                .join("")
                                .slice(0, 2)}
                            </div>
                            <div className="min-w-0">
                              <div className="flex flex-wrap items-center gap-2">
                                <h2 className="truncate text-lg font-semibold text-[color:var(--foreground)]">
                                  {selectedTicket.teamName}
                                </h2>
                                <TicketTypeBadge ticketType={selectedTicket.ticketType} />
                                <StatusBadge status={selectedTicket.status} />
                              </div>
                              <p className="mt-1 truncate text-sm text-[color:var(--muted-foreground)]">
                                {selectedTicket.factoryName} • Deploy {formatDate(selectedTicket.deploymentDate)} • Owner {selectedTicket.requestOwner}
                              </p>
                            </div>
                          </div>
                          <div className="flex flex-wrap items-center gap-2">
                            <span className="rounded-full border border-[color:var(--border)] px-3 py-1 text-[11px] uppercase tracking-[0.16em] text-[color:var(--muted-foreground)]">
                              {streamStatus}
                            </span>
                            {quickHeaderActions.map((action) => (
                              <button
                                key={`quick-${action}`}
                                type="button"
                                onClick={() => void handleStatusUpdate(action)}
                                disabled={statusPending}
                                className={`rounded-full px-4 py-2 text-xs font-semibold uppercase tracking-[0.16em] ${
                                  action === "accepted"
                                    ? "bg-[#00a884] text-[#0b141a]"
                                    : "bg-[#f15c6d] text-[color:var(--foreground)]"
                                } disabled:opacity-60`}
                              >
                                {statusPending ? "Updating..." : statusLabel(action)}
                              </button>
                            ))}
                          </div>
                        </div>
                      </div>

                      <div
                        ref={chatListRef}
                        className="min-h-0 flex-1 overflow-y-auto bg-[color:var(--background)] p-4 lg:p-6"
                      >
                        <div className="flex min-h-full flex-col gap-5">
                          {orderedMessages.map((message) => {
                            const isOwnMessage = message.author === viewer.name;

                            return (
                              <div
                                key={message.id}
                                id={`chat-message-${message.id}`}
                                className={`flex flex-col gap-1.5 ${isOwnMessage ? "items-end text-right" : "items-start text-left"}`}
                              >
                                <div className={`flex items-center gap-2 px-1 ${isOwnMessage ? "flex-row-reverse" : "flex-row"}`}>
                                  <span className="text-[10px] font-bold uppercase tracking-[0.2em] text-[color:var(--muted-foreground)]">
                                    {message.author}
                                  </span>
                                  <RoleBadge role={message.role} />
                                </div>
                                <div className={`group relative max-w-[94%] sm:max-w-[88%] lg:max-w-[78%]`}>
                                  <article
                                    className={`relative overflow-hidden rounded-2xl px-4 py-3 shadow-md ring-1 ring-inset transition-all duration-200 ${
                                      isOwnMessage
                                        ? "bg-[color:var(--primary)] text-[color:var(--primary-foreground)] ring-[color:var(--primary)]/10"
                                        : "bg-[color:var(--card)] text-[color:var(--foreground)] ring-[color:var(--border)]"
                                    }`}
                                    onTouchStart={(event) =>
                                      beginSwipe(message.id, event.touches[0]?.clientX ?? 0)
                                    }
                                    onTouchMove={(event) =>
                                      moveSwipe(message.id, event.touches[0]?.clientX ?? 0)
                                    }
                                    onTouchEnd={() => endSwipe(message)}
                                    onTouchCancel={() => {
                                      setActiveSwipeMessageId(null);
                                      setActiveSwipeOffset(0);
                                    }}
                                  >
                                    <div className="flex flex-wrap items-center justify-between gap-4">
                                      <span className={`text-[10px] font-medium tracking-wide ${isOwnMessage ? "text-[color:var(--primary-foreground)]/60" : "text-[color:var(--muted-foreground)]"}`}>
                                        {formatDateTime(message.sentAt)}
                                      </span>
                                    </div>
                                    {message.replyToMessageId ? (
                                      <button
                                        type="button"
                                        onClick={() => {
                                          const target = document.getElementById(
                                            `chat-message-${message.replyToMessageId}`,
                                          );
                                          target?.scrollIntoView({ behavior: "smooth", block: "center" });
                                        }}
                                        className={`mt-2.5 block w-full rounded-xl border p-2.5 text-left text-[11px] transition-all hover:opacity-80 ${
                                          isOwnMessage
                                            ? "border-white/10 bg-black/10"
                                            : "border-[color:var(--border)] bg-[color:var(--muted)]/50"
                                        }`}
                                      >
                                        <div className="font-bold uppercase tracking-wider opacity-60">
                                          {message.replyToAuthor}
                                        </div>
                                        <div className="mt-1 line-clamp-1 italic opacity-80">
                                          {message.replyToExcerpt}
                                        </div>
                                      </button>
                                    ) : null}
                                    <p className="mt-2.5 whitespace-pre-wrap break-words text-sm leading-relaxed">
                                      {message.message}
                                    </p>
                                    <div className={`mt-3 flex gap-2 ${isOwnMessage ? "justify-end" : "justify-start"}`}>
                                      <button
                                        type="button"
                                        onClick={() => beginReply(message)}
                                        className={`transition-colors text-[10px] font-bold uppercase tracking-widest ${
                                          isOwnMessage
                                            ? "text-[color:var(--primary-foreground)]/60 hover:text-[color:var(--primary-foreground)]"
                                            : "text-[color:var(--muted-foreground)] hover:text-[color:var(--foreground)]"
                                        }`}
                                      >
                                        Reply
                                      </button>
                                    </div>
                                  </article>
                                </div>
                              </div>
                            );
                          })}
                        </div>
                      </div>

                      <div className="border-t border-[color:var(--border)] bg-[color:var(--card)] px-3 py-4 sm:px-4 lg:px-6">
                        <div className="w-full">
                          {replyTarget ? (
                            <div className="mb-3 flex items-center justify-between gap-3 rounded-2xl border border-[color:var(--border)] bg-[#1b2a30] px-3 py-2">
                              <div className="min-w-0">
                                <p className="text-[10px] uppercase tracking-[0.16em] text-[#53bdeb]">
                                  Replying to {replyTarget.author}
                                </p>
                                <p className="truncate text-sm text-[color:var(--foreground)]">
                                  {replyExcerpt(replyTarget.message)}
                                </p>
                              </div>
                              <button
                                type="button"
                                onClick={clearReplyTarget}
                                className="rounded-full border border-[color:var(--border)] px-2.5 py-1 text-xs font-semibold text-[color:var(--foreground)]"
                              >
                                Cancel
                              </button>
                            </div>
                          ) : null}
                          <div className="grid gap-3 md:grid-cols-[minmax(0,1fr)_auto] md:items-end">
                            <div className="grid gap-2">
                              <textarea
                                ref={messageComposerRef}
                                value={messageDraft}
                                onChange={(event) => setMessageDraft(event.target.value)}
                                rows={3}
                                disabled={!canChat || messagePending}
                                className="rounded-xl border border-[color:var(--border)] bg-[color:var(--card)] px-4 py-3 text-sm text-[color:var(--foreground)] outline-none shadow-sm focus:ring-1 focus:ring-[color:var(--accent)] disabled:opacity-60"
                                placeholder="Type a message..."
                              />
                              <div className="flex items-center justify-between gap-3">
                                <span className="text-[10px] font-bold uppercase tracking-widest text-[color:var(--muted-foreground)] opacity-70">
                                  Posting as {viewerRoleLabel(viewer.role)}
                                </span>
                                {messageFeedback ? (
                                  <p className="text-sm text-[color:var(--muted-foreground)]">{messageFeedback}</p>
                                ) : null}
                              </div>
                            </div>
                            <button
                              type="button"
                              onClick={() => void handleSendMessage()}
                              disabled={!canChat || messagePending || !messageDraft.trim()}
                              className="h-11 rounded-xl bg-[color:var(--foreground)] px-6 text-[11px] font-bold uppercase tracking-[0.2em] text-white shadow-lg transition-all hover:scale-[1.02] active:scale-[0.98] disabled:opacity-60"
                            >
                              {messagePending ? "..." : "Send"}
                            </button>
                          </div>
                        </div>
                      </div>
                    </div>

                    <aside className="flex min-h-0 flex-col border-t border-[color:var(--border)] bg-[color:var(--card)] lg:border-t-0">
                      <div className="border-b border-[color:var(--border)] bg-[color:var(--card)]/50 px-3 py-3 backdrop-blur-sm">
                        <div className="flex gap-1 overflow-x-auto hover:scrollbar-thin">
                          {[
                            { id: "tracking" as DetailPanelId, label: "Tracking" },
                            { id: "actions" as DetailPanelId, label: "Actions" },
                            { id: "packets" as DetailPanelId, label: "Packages" },
                          ].map((tab) => {
                            const active = detailPanel === tab.id;

                            return (
                              <button
                                key={tab.id}
                                type="button"
                                onClick={() => setDetailPanel(tab.id)}
                                className={`whitespace-nowrap px-4 py-2 text-[10px] font-bold uppercase tracking-[0.16em] transition-all duration-200 border-b-2 ${
                                  active
                                    ? "border-[color:var(--accent)] text-[color:var(--foreground)]"
                                    : "border-transparent text-[color:var(--muted-foreground)] hover:text-[color:var(--foreground)]"
                                }`}
                              >
                                {tab.label}
                              </button>
                            );
                          })}
                        </div>
                      </div>

                      <div className="min-h-0 flex-1 overflow-y-auto p-4">
                        {detailPanel === "tracking" ? (
                          <div className="grid gap-4">
                            <div className="rounded-3xl border border-[color:var(--border)] bg-[color:var(--muted)] p-4">
                              <p className="text-[11px] uppercase tracking-[0.18em] text-[color:var(--muted-foreground)]">
                                Tracking history
                              </p>
                              <div className="mt-4">
                                <TimelineList events={selectedTicket.timeline} />
                              </div>
                            </div>
                          </div>
                        ) : null}

                        {detailPanel === "actions" ? (
                          <div className="grid gap-4">
                            <div className="rounded-3xl border border-[color:var(--border)] bg-[color:var(--muted)] p-4">
                              <p className="text-[11px] uppercase tracking-[0.18em] text-[color:var(--muted-foreground)]">
                                Ticket actions
                              </p>
                              <label className="mt-3 grid gap-2 text-sm text-[color:var(--foreground)]">
                                Status note
                                <textarea
                                  value={statusNote}
                                  onChange={(event) => setStatusNote(event.target.value)}
                                  rows={3}
                                  disabled={!canUpdateStatus || statusPending}
                                  className="rounded-2xl border border-[color:var(--border)] bg-[color:var(--secondary)] px-3 py-3 text-sm text-[color:var(--foreground)] outline-none disabled:opacity-60"
                                  placeholder="Add the operational note for this transition"
                                />
                              </label>
                              <div className="mt-4 flex flex-wrap gap-2">
                                {sidebarStatusActions.length > 0 ? (
                                  sidebarStatusActions.map((action) => (
                                    <button
                                      key={action}
                                      type="button"
                                      onClick={() => void handleStatusUpdate(action)}
                                      disabled={statusPending}
                                      className="rounded-full border border-[color:var(--border)] px-3 py-2 text-xs font-semibold uppercase tracking-[0.16em] text-[color:var(--foreground)] disabled:opacity-60"
                                    >
                                      {statusPending ? "Updating..." : statusLabel(action)}
                                    </button>
                                  ))
                                ) : (
                                  <span className="text-xs uppercase tracking-[0.16em] text-[color:var(--muted-foreground)]">
                                    No more state changes are available here.
                                  </span>
                                )}
                              </div>
                              {statusFeedback ? (
                                <p className="mt-3 text-sm text-[color:var(--muted-foreground)]">{statusFeedback}</p>
                              ) : null}
                            </div>

                            <div className="rounded-3xl border border-[color:var(--border)] bg-[color:var(--muted)] p-4">
                              <p className="text-[11px] uppercase tracking-[0.18em] text-[color:var(--muted-foreground)]">
                                Close ticket
                              </p>
                              <label className="mt-3 grid gap-2 text-sm text-[color:var(--foreground)]">
                                Closure note
                                <textarea
                                  value={closeNote}
                                  onChange={(event) => setCloseNote(event.target.value)}
                                  rows={3}
                                  disabled={!canCloseTicket || closePending}
                                  className="rounded-2xl border border-[color:var(--border)] bg-[color:var(--secondary)] px-3 py-3 text-sm text-[color:var(--foreground)] outline-none disabled:opacity-60"
                                />
                              </label>
                              <div className="mt-4 flex items-center justify-between gap-3">
                                <span className="text-xs uppercase tracking-[0.16em] text-[color:var(--muted-foreground)]">
                                  {canCloseTicket
                                    ? `Close available for ${viewerRoleLabel(viewer.role)}`
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
                                  className="rounded-full bg-[#00a884] px-4 py-2 text-sm font-semibold text-[#0b141a] disabled:opacity-60"
                                >
                                  {closePending ? "Closing..." : "Close Ticket"}
                                </button>
                              </div>
                              {closeFeedback ? (
                                <p className="mt-3 text-sm text-[color:var(--muted-foreground)]">{closeFeedback}</p>
                              ) : null}
                            </div>
                          </div>
                        ) : null}

                        {detailPanel === "packets" ? (
                          <div className="grid gap-4">
                            {canEditPackages && (viewer.role === "admin" || viewer.role === "logistics") ? (
                              <div className="rounded-3xl border border-[color:var(--border)] bg-[color:var(--muted)] p-4">
                                <div className="flex items-center justify-between gap-3">
                                  <div>
                                    <p className="text-[11px] uppercase tracking-[0.18em] text-[color:var(--muted-foreground)]">
                                      Generate labels
                                    </p>
                                    <h3 className="mt-2 text-base font-semibold text-[color:var(--foreground)]">
                                      Create QR batch
                                    </h3>
                                  </div>
                                  <span className="text-xs uppercase tracking-[0.16em] text-[color:var(--muted-foreground)]">
                                    {viewerRoleLabel(viewer.role)}
                                  </span>
                                </div>
                                <div className="mt-4 grid gap-3">
                                  <input
                                    type="number"
                                    min={1}
                                    value={packageDraft.labelCount || ""}
                                    onChange={(event) =>
                                      setPackageDraft((current) => ({
                                        ...current,
                                        labelCount: Number(event.target.value),
                                      }))
                                    }
                                    placeholder="Number of QR labels"
                                    className="rounded-2xl border border-[color:var(--border)] bg-[color:var(--secondary)] px-3 py-3 text-sm text-[color:var(--foreground)] outline-none"
                                  />
                                  <div className="grid gap-3 sm:grid-cols-2">
                                    <input
                                      type="number"
                                      min={0}
                                      value={packageDraft.shippedSdCardsCount || ""}
                                      onChange={(event) =>
                                        setPackageDraft((current) => ({
                                          ...current,
                                          shippedSdCardsCount: Number(event.target.value),
                                        }))
                                      }
                                      placeholder="Shipped SD cards"
                                      className="rounded-2xl border border-[color:var(--border)] bg-[color:var(--secondary)] px-3 py-3 text-sm text-[color:var(--foreground)] outline-none"
                                    />
                                    <input
                                      type="number"
                                      min={0}
                                      value={packageDraft.shippedDevicesCount || ""}
                                      onChange={(event) =>
                                        setPackageDraft((current) => ({
                                          ...current,
                                          shippedDevicesCount: Number(event.target.value),
                                        }))
                                      }
                                      placeholder="Shipped devices"
                                      className="rounded-2xl border border-[color:var(--border)] bg-[color:var(--secondary)] px-3 py-3 text-sm text-[color:var(--foreground)] outline-none"
                                    />
                                    <input
                                      type="number"
                                      min={0}
                                      value={packageDraft.shippedUsbHubsCount || ""}
                                      onChange={(event) =>
                                        setPackageDraft((current) => ({
                                          ...current,
                                          shippedUsbHubsCount: Number(event.target.value),
                                        }))
                                      }
                                      placeholder="Shipped USB hubs"
                                      className="rounded-2xl border border-[color:var(--border)] bg-[color:var(--secondary)] px-3 py-3 text-sm text-[color:var(--foreground)] outline-none"
                                    />
                                    <input
                                      type="number"
                                      min={0}
                                      value={packageDraft.shippedCablesCount || ""}
                                      onChange={(event) =>
                                        setPackageDraft((current) => ({
                                          ...current,
                                          shippedCablesCount: Number(event.target.value),
                                        }))
                                      }
                                      placeholder="Shipped cables"
                                      className="rounded-2xl border border-[color:var(--border)] bg-[color:var(--secondary)] px-3 py-3 text-sm text-[color:var(--foreground)] outline-none"
                                    />
                                  </div>
                                  <input
                                    value={packageDraft.note}
                                    onChange={(event) =>
                                      setPackageDraft((current) => ({
                                        ...current,
                                        note: event.target.value,
                                      }))
                                    }
                                    placeholder="Shared QR label note"
                                    className="rounded-2xl border border-[color:var(--border)] bg-[color:var(--secondary)] px-3 py-3 text-sm text-[color:var(--foreground)] outline-none"
                                  />
                                  <div className="flex items-center justify-between gap-3">
                                    <p className="text-xs leading-5 text-[color:var(--muted-foreground)]">
                                      One shared payload. Build AI generates {packageDraft.labelCount || 0} unique QR IDs for this ticket.
                                    </p>
                                    <button
                                      type="button"
                                      onClick={() => void handleCreatePackage()}
                                      disabled={packageCreatePending || !selectedTicket}
                                      className="rounded-full bg-[#00a884] px-4 py-2 text-sm font-semibold text-[#0b141a] disabled:opacity-60"
                                    >
                                      {packageCreatePending ? "Generating..." : "Generate"}
                                    </button>
                                  </div>
                                  {packageCreateFeedback ? (
                                    <p className="text-sm text-[color:var(--muted-foreground)]">{packageCreateFeedback}</p>
                                  ) : null}
                                </div>
                              </div>
                            ) : null}

                            <div className="rounded-3xl border border-[color:var(--border)] bg-[color:var(--muted)] p-4">
                              <label className="grid gap-2 text-sm text-[color:var(--foreground)]">
                                QR lookup
                                <div className="flex flex-col gap-2 sm:flex-row">
                                  <input
                                    value={qrLookup}
                                    onChange={(event) => setQrLookup(event.target.value)}
                                    placeholder="Paste or scan QR token"
                                    className="flex-1 rounded-2xl border border-[color:var(--border)] bg-[color:var(--secondary)] px-3 py-3 text-sm text-[color:var(--foreground)] outline-none"
                                  />
                                  <button
                                    type="button"
                                    onClick={() => void handleLoadQrDetail()}
                                    disabled={!canViewPackages || qrPending || !qrLookup.trim()}
                                    className="rounded-full border border-[color:var(--border)] px-4 py-3 text-sm font-semibold text-[color:var(--foreground)] disabled:opacity-60"
                                  >
                                    {qrPending ? "Loading..." : "Open"}
                                  </button>
                                </div>
                              </label>
                            </div>

                            <div className="grid gap-3">
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
                              <label className="grid gap-2 text-sm text-[color:var(--foreground)]">
                                Packet lifecycle note
                                <textarea
                                  value={packageActionNote}
                                  onChange={(event) => setPackageActionNote(event.target.value)}
                                  rows={3}
                                  disabled={!canUpdatePackageStatus || packagePending}
                                  className="rounded-2xl border border-[color:var(--border)] bg-[color:var(--secondary)] px-3 py-3 text-sm text-[color:var(--foreground)] outline-none disabled:opacity-60"
                                  placeholder="Add a note before moving a specific packet"
                                />
                              </label>
                              {packageFeedback ? (
                                <p className="text-sm text-[color:var(--muted-foreground)]">{packageFeedback}</p>
                              ) : null}
                            </div>

                            {qrDetail ? (
                              <div className="grid gap-4 rounded-3xl border border-[color:var(--border)] bg-[color:var(--muted)] p-4">
                                <div className="grid gap-4 lg:grid-cols-[0.8fr_1.2fr]">
                                  <div className="space-y-3">
                                    {qrDetail.qrSvgPath ? (
                                      <div className="rounded-3xl border border-[color:var(--border)] bg-[color:var(--card)] p-4">
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
                                    <div className="rounded-3xl border border-[color:var(--border)] bg-[color:var(--card)] p-4 text-sm">
                                      <p className="font-semibold text-[color:var(--foreground)]">
                                        {qrDetail.package.packageCode}
                                      </p>
                                      <p className="mt-2 break-all text-[11px] uppercase tracking-[0.14em] text-[color:var(--muted-foreground)]">
                                        {qrDetail.package.qrToken}
                                      </p>
                                      <p className="mt-3 break-all text-[color:var(--muted-foreground)]">{qrDetail.scanUrl}</p>
                                      <a
                                        href={qrDetail.scanUrl}
                                        target="_blank"
                                        rel="noreferrer"
                                        className="mt-3 inline-flex rounded-full border border-[color:var(--border)] px-3 py-2 text-xs font-semibold uppercase tracking-[0.16em] text-[color:var(--foreground)]"
                                      >
                                        Open public page
                                      </a>
                                    </div>
                                  </div>

                                  <div className="grid gap-3">
                                    <div className="grid gap-3 sm:grid-cols-2">
                                      <div className="rounded-3xl border border-[color:var(--border)] bg-[color:var(--card)] p-4 text-sm">
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
                                      <div className="rounded-3xl border border-[color:var(--border)] bg-[color:var(--card)] p-4 text-sm">
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
                                        className="rounded-2xl border border-[color:var(--border)] bg-[color:var(--secondary)] px-3 py-3 text-sm text-[color:var(--foreground)] outline-none disabled:opacity-60"
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
                                        className="rounded-2xl border border-[color:var(--border)] bg-[color:var(--secondary)] px-3 py-3 text-sm text-[color:var(--foreground)] outline-none disabled:opacity-60"
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
                                        className="rounded-2xl border border-[color:var(--border)] bg-[color:var(--secondary)] px-3 py-3 text-sm text-[color:var(--foreground)] outline-none disabled:opacity-60"
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
                                        className="rounded-2xl border border-[color:var(--border)] bg-[color:var(--secondary)] px-3 py-3 text-sm text-[color:var(--foreground)] outline-none disabled:opacity-60"
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
                                        className="rounded-2xl border border-[color:var(--border)] bg-[color:var(--secondary)] px-3 py-3 text-sm text-[color:var(--foreground)] outline-none disabled:opacity-60"
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
                                        className="rounded-2xl border border-[color:var(--border)] bg-[color:var(--secondary)] px-3 py-3 text-sm text-[color:var(--foreground)] outline-none disabled:opacity-60"
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
                                        className="rounded-2xl border border-[color:var(--border)] bg-[color:var(--secondary)] px-3 py-3 text-sm text-[color:var(--foreground)] outline-none disabled:opacity-60"
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
                                      className="rounded-2xl border border-[color:var(--border)] bg-[color:var(--secondary)] px-3 py-3 text-sm text-[color:var(--foreground)] outline-none disabled:opacity-60"
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
                                        className="rounded-full bg-[#00a884] px-4 py-2 text-sm font-semibold text-[#0b141a] disabled:opacity-60"
                                      >
                                        {qrPending ? "Saving..." : "Save QR Detail"}
                                      </button>
                                    </div>
                                    {qrFeedback ? (
                                      <p className="text-sm text-[color:var(--muted-foreground)]">{qrFeedback}</p>
                                    ) : null}
                                  </div>
                                </div>
                              </div>
                            ) : null}
                          </div>
                        ) : null}
                      </div>
                    </aside>
                  </div>
                ) : (
                  <div className="flex min-h-[520px] flex-col items-center justify-center p-8 text-center">
                    <div className="max-w-md space-y-6">
                      <div className="mx-auto flex h-20 w-20 items-center justify-center rounded-3xl bg-[color:var(--accent-soft)] text-[color:var(--accent)]">
                        <svg className="h-10 w-10" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M12 4v16m8-8H4" />
                        </svg>
                      </div>
                      <div className="space-y-2">
                        <h2 className="font-display text-2xl font-semibold tracking-[-0.03em] text-[color:var(--foreground)]">
                          Moto Deployment Tracking
                        </h2>
                        <p className="text-sm leading-6 text-[color:var(--muted-foreground)]">
                          Raise a new hardware request or select an existing ticket from the sidebar to track its lifecycle.
                        </p>
                      </div>
                      {canCreateTicket && (
                        <button
                          type="button"
                          onClick={() => setShowCreateTicketForm(true)}
                          className="rounded-full border border-[color:var(--foreground)] bg-[color:var(--foreground)] px-6 py-3 text-sm font-semibold uppercase tracking-[0.16em] text-white transition hover:opacity-90"
                        >
                          Raise New Request
                        </button>
                      )}
                    </div>
                  </div>
                )}
                </section>
              </div>

              {canCreateTicket && showCreateTicketForm ? (
                <div
                  className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 px-4 py-6"
                  onClick={() => setShowCreateTicketForm(false)}
                >
                  <div
                    className="max-h-[90vh] w-full max-w-3xl overflow-y-auto rounded-[28px] border border-[color:var(--border)] bg-[color:var(--background)]"
                    onClick={(event) => event.stopPropagation()}
                  >
                    <div className="flex items-start justify-between gap-4 border-b border-[color:var(--border)] px-6 py-5">
                      <div>
                        <p className="font-mono text-[11px] uppercase tracking-[0.18em] text-[color:var(--muted-foreground)]">
                          New ticket
                        </p>
                        <h2 className="mt-2 text-xl font-semibold tracking-[-0.03em] text-[color:var(--foreground)]">
                          Create deployment or transfer request
                        </h2>
                      </div>
                      <button
                        type="button"
                        onClick={() => setShowCreateTicketForm(false)}
                        className="rounded-full border border-[color:var(--border)] px-3 py-2 text-[11px] font-semibold uppercase tracking-[0.16em] text-[color:var(--foreground)]"
                      >
                        Close
                      </button>
                    </div>
                    <div className="grid gap-4 px-6 py-5">
                      <div className="grid gap-3 sm:grid-cols-2">
                        <select
                          value={ticketDraft.ticketType}
                          onChange={(event) =>
                            setTicketDraft((current) => ({
                              ...current,
                              ticketType: event.target.value as TicketType,
                            }))
                          }
                          className="rounded-xl border border-[color:var(--border)] bg-[color:var(--background)] px-3 py-3 text-sm text-[color:var(--foreground)] outline-none"
                        >
                          <option value="deployment">Deployment request</option>
                          <option value="transfer">Factory transfer</option>
                        </select>
                        <select
                          value={ticketDraft.priority}
                          onChange={(event) =>
                            setTicketDraft((current) => ({
                              ...current,
                              priority: event.target.value as TicketCreateInput["priority"],
                            }))
                          }
                          className="rounded-xl border border-[color:var(--border)] bg-[color:var(--background)] px-3 py-3 text-sm text-[color:var(--foreground)] outline-none"
                        >
                          <option value="high">High priority</option>
                          <option value="medium">Medium priority</option>
                          <option value="low">Low priority</option>
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
                          className="rounded-xl border border-[color:var(--border)] bg-[color:var(--background)] px-3 py-3 text-sm text-[color:var(--foreground)] outline-none"
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
                          className="rounded-xl border border-[color:var(--border)] bg-[color:var(--background)] px-3 py-3 text-sm text-[color:var(--foreground)] outline-none"
                        />
                        <input
                          type="date"
                          value={ticketDraft.deploymentDate}
                          onChange={(event) =>
                            setTicketDraft((current) => ({
                              ...current,
                              deploymentDate: event.target.value,
                            }))
                          }
                          className="rounded-xl border border-[color:var(--border)] bg-[color:var(--background)] px-3 py-3 text-sm text-[color:var(--foreground)] outline-none"
                        />
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
                          className="rounded-xl border border-[color:var(--border)] bg-[color:var(--background)] px-3 py-3 text-sm text-[color:var(--foreground)] outline-none"
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
                          className="rounded-xl border border-[color:var(--border)] bg-[color:var(--background)] px-3 py-3 text-sm text-[color:var(--foreground)] outline-none"
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
                          className="rounded-xl border border-[color:var(--border)] bg-[color:var(--background)] px-3 py-3 text-sm text-[color:var(--foreground)] outline-none"
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
                              className="rounded-xl border border-[color:var(--border)] bg-[color:var(--background)] px-3 py-3 text-sm text-[color:var(--foreground)] outline-none"
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
                              className="rounded-xl border border-[color:var(--border)] bg-[color:var(--background)] px-3 py-3 text-sm text-[color:var(--foreground)] outline-none"
                            />
                            <input
                              value={ticketDraft.linkedTicketId ?? ""}
                              onChange={(event) =>
                                setTicketDraft((current) => ({
                                  ...current,
                                  linkedTicketId: event.target.value,
                                }))
                              }
                              placeholder="Linked source ticket ID"
                              className="rounded-xl border border-[color:var(--border)] bg-[color:var(--background)] px-3 py-3 text-sm text-[color:var(--foreground)] outline-none sm:col-span-2"
                            />
                          </>
                        ) : null}
                      </div>
                      <p className="text-xs uppercase tracking-[0.16em] text-[color:var(--muted-foreground)]">
                        Ticket title is generated automatically from team, factory, deployment date, and requested quantities.
                      </p>
                      <div className="flex items-center justify-between gap-3">
                        <button
                          type="button"
                          onClick={() => setShowCreateTicketForm(false)}
                          className="rounded-full border border-[color:var(--border)] px-4 py-2 text-sm font-semibold text-[color:var(--foreground)]"
                        >
                          Cancel
                        </button>
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
                          className="rounded-full border border-[color:var(--foreground)] bg-[color:var(--foreground)] px-5 py-2 text-sm font-semibold text-white disabled:opacity-60"
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
                  </div>
                </div>
              ) : null}
            </>
          ) : (
            <section className="min-h-[calc(100vh-88px)] bg-[color:var(--background)] p-4 lg:h-screen lg:min-h-0 lg:p-6">
              <div className="mb-4 flex flex-wrap items-start justify-between gap-3">
                <div>
                  <p className="text-[11px] uppercase tracking-[0.18em] text-[color:var(--muted-foreground)]">
                    {currentWorkspace?.label ?? "Workspace"}
                  </p>
                  <h1 className="mt-2 text-2xl font-semibold tracking-[-0.04em] text-[color:var(--foreground)]">
                    {currentWorkspace?.label ?? "Operations"}
                  </h1>
                </div>
                <div className="flex flex-wrap items-center gap-2">
                  <span
                    className={`inline-flex items-center rounded-full border px-3 py-1 text-[11px] font-semibold uppercase tracking-[0.16em] ${
                      health.ok ? "status-success" : "status-error"
                    }`}
                  >
                    API {health.ok ? "Healthy" : "Unavailable"}
                  </span>
                  <span className="rounded-full border border-[color:var(--border)] px-3 py-1 text-[11px] uppercase tracking-[0.16em] text-[color:var(--muted-foreground)]">
                    {session.user.displayName}
                  </span>
                </div>
              </div>

              {workspace === "home" ? (
                <div className="grid gap-4 xl:grid-cols-[minmax(0,1.25fr)_360px]">
                  <section className="panel-shell overflow-hidden">
                    <PanelHeader
                      eyebrow="Overview"
                      title="Operations home"
                      helper="Use tickets for conversations. Use the other pages only for the operational context that belongs there."
                    />
                    <div className="grid gap-4 p-5 md:grid-cols-2 xl:grid-cols-3">
                      <article className="rounded-3xl border border-[color:var(--border)] bg-[color:var(--card)] p-4">
                        <p className="font-mono text-[11px] uppercase tracking-[0.16em] text-[color:var(--muted-foreground)]">
                          Open tickets
                        </p>
                        <p className="mt-2 text-3xl font-semibold tracking-[-0.05em] text-[color:var(--foreground)]">
                          {openTicketCount}
                        </p>
                      </article>
                      <article className="rounded-3xl border border-[color:var(--border)] bg-[color:var(--card)] p-4">
                        <p className="font-mono text-[11px] uppercase tracking-[0.16em] text-[color:var(--muted-foreground)]">
                          Active packets
                        </p>
                        <p className="mt-2 text-3xl font-semibold tracking-[-0.05em] text-[color:var(--foreground)]">
                          {packetCount}
                        </p>
                      </article>
                      <article className="rounded-3xl border border-[color:var(--border)] bg-[color:var(--card)] p-4">
                        <p className="font-mono text-[11px] uppercase tracking-[0.16em] text-[color:var(--muted-foreground)]">
                          Merit alerts
                        </p>
                        <p className="mt-2 text-3xl font-semibold tracking-[-0.05em] text-[color:var(--foreground)]">
                          {activeMeritAlertCount}
                        </p>
                      </article>
                    </div>
                    <div className="grid gap-4 border-t border-[color:var(--border)] p-5 xl:grid-cols-[minmax(0,1fr)_280px]">
                      <div className="space-y-3">
                        <div className="flex items-center justify-between gap-3">
                          <h2 className="text-base font-semibold text-[color:var(--foreground)]">
                            Recent ticket activity
                          </h2>
                          <Link
                            href="/tickets"
                            className="rounded-full border border-[color:var(--foreground)] bg-[color:var(--foreground)] px-4 py-2 text-xs font-semibold uppercase tracking-[0.16em] text-white"
                          >
                            Open tickets
                          </Link>
                        </div>
                        <div className="overflow-hidden rounded-3xl border border-[color:var(--border)]">
                          {recentTickets.map((ticket) => (
                            <Link
                              key={ticket.id}
                              href="/tickets"
                              className="flex items-center justify-between gap-4 border-b border-[color:var(--border)] bg-[color:var(--card)] px-4 py-3 last:border-b-0 hover:bg-[color:var(--muted)]"
                            >
                              <div className="min-w-0">
                                <p className="truncate text-sm font-semibold text-[color:var(--foreground)]">
                                  {ticket.teamName}
                                </p>
                                <p className="truncate text-xs text-[color:var(--muted-foreground)]">
                                  {ticket.factoryName} • {ticket.id}
                                </p>
                              </div>
                              <StatusBadge status={ticket.status} />
                            </Link>
                          ))}
                        </div>
                        {selectedTicket ? (
                          <div className="rounded-3xl border border-[color:var(--border)] bg-[color:var(--card)] p-4">
                            <div className="flex items-center justify-between gap-3">
                              <div>
                                <p className="text-[11px] uppercase tracking-[0.18em] text-[color:var(--muted-foreground)]">
                                  Highlighted request
                                </p>
                                <h3 className="mt-2 text-base font-semibold text-[color:var(--foreground)]">
                                  {selectedTicket.title}
                                </h3>
                              </div>
                              <span className="rounded-full border border-[color:var(--border)] px-3 py-1 text-[11px] uppercase tracking-[0.16em] text-[color:var(--muted-foreground)]">
                                {selectedTicket.id}
                              </span>
                            </div>
                            <p className="mt-3 text-sm leading-6 text-[color:var(--muted-foreground)]">
                              {selectedTicket.summary}
                            </p>
                            <div className="mt-4 grid gap-2 text-sm text-[color:var(--muted-foreground)] sm:grid-cols-3">
                              <div className="flex items-center justify-between gap-3 sm:block">
                                <p>Priority</p>
                                <p className="mt-1 font-medium text-[color:var(--foreground)]">
                                  {selectedTicket.priority}
                                </p>
                              </div>
                              <div className="flex items-center justify-between gap-3 sm:block">
                                <p>Workers</p>
                                <p className="mt-1 font-medium text-[color:var(--foreground)]">
                                  {selectedTicket.workerCount}
                                </p>
                              </div>
                              <div className="flex items-center justify-between gap-3 sm:block">
                                <p>Request owner</p>
                                <p className="mt-1 font-medium text-[color:var(--foreground)]">
                                  {selectedTicket.requestOwner}
                                </p>
                              </div>
                            </div>
                            {selectedTicket.ticketType === "transfer" ? (
                              <div className="mt-4 rounded-2xl border border-[color:var(--border)] bg-[color:var(--muted)] px-4 py-3 text-sm text-[color:var(--muted-foreground)]">
                                Source: {selectedTicket.sourceTeamName} / {selectedTicket.sourceFactoryName}
                              </div>
                            ) : null}
                            <div className="mt-4">
                              <p className="text-[11px] uppercase tracking-[0.18em] text-[color:var(--muted-foreground)]">
                                Requested inventory
                              </p>
                              <div className="mt-3">
                                <ItemTable items={selectedTicket.items} />
                              </div>
                            </div>
                          </div>
                        ) : null}
                      </div>
                      <div className="space-y-4">
                        <div className="rounded-3xl border border-[color:var(--border)] bg-[color:var(--card)] p-4">
                          <p className="font-mono text-[11px] uppercase tracking-[0.16em] text-[color:var(--muted-foreground)]">
                            Logged in as
                          </p>
                          <p className="mt-2 text-sm font-semibold text-[color:var(--foreground)]">
                            {session.user.displayName}
                          </p>
                          <p className="mt-1 text-xs uppercase tracking-[0.16em] text-[color:var(--muted-foreground)]">
                            {viewerRoleLabel(session.user.role)}
                          </p>
                        </div>
                        <div className="rounded-3xl border border-[color:var(--border)] bg-[color:var(--card)] p-4">
                          <p className="font-mono text-[11px] uppercase tracking-[0.16em] text-[color:var(--muted-foreground)]">
                            Backend
                          </p>
                          <p className="mt-2 text-sm font-semibold text-[color:var(--foreground)]">
                            {health.baseUrl.replace(/^https?:\/\//, "")}
                          </p>
                          <p className="mt-1 text-xs uppercase tracking-[0.16em] text-[color:var(--muted-foreground)]">
                            {health.ok ? "Healthy" : "Unavailable"}
                          </p>
                        </div>
                      </div>
                    </div>
                  </section>
                </div>
              ) : null}

              {workspace === "ingestion" ? (
                <div className="grid gap-4">
                  {selectedTicket ? (
                    <section className="panel-shell overflow-hidden">
                      <PanelHeader eyebrow="Selected Ticket" title={selectedTicket.teamName} />
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
                                  value: selectedTicket.ingestionReport.actualSdCardsReceived,
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
                                  className="rounded-3xl border border-[color:var(--border)] bg-[color:var(--card)] p-4"
                                >
                                  <p className="text-[11px] uppercase tracking-[0.16em] text-[color:var(--muted-foreground)]">
                                    {item.label}
                                  </p>
                                  <p className="mt-2 text-3xl font-semibold tracking-[-0.05em] text-[color:var(--foreground)]">
                                    {item.value}
                                  </p>
                                </div>
                              ))}
                            </div>
                            <div className="rounded-3xl border border-[color:var(--border)] bg-[color:var(--card)] p-4">
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
                          <div className="rounded-3xl border border-[color:var(--border)] bg-[color:var(--card)] p-4 text-sm text-[color:var(--muted-foreground)]">
                            Ingestion has not started for this ticket yet.
                          </div>
                        )}

                        {canReconcileIngestion ? (
                          <div className="grid gap-3 rounded-3xl border border-[color:var(--border)] bg-[color:var(--muted)] p-4">
                            <div className="flex items-center justify-between gap-3">
                              <div>
                                <p className="text-[11px] uppercase tracking-[0.16em] text-[color:var(--muted-foreground)]">
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
                                className="rounded-2xl border border-[color:var(--border)] bg-[color:var(--secondary)] px-3 py-3 text-sm text-[color:var(--foreground)] outline-none"
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
                                className="rounded-2xl border border-[color:var(--border)] bg-[color:var(--secondary)] px-3 py-3 text-sm text-[color:var(--foreground)] outline-none"
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
                                className="rounded-2xl border border-[color:var(--border)] bg-[color:var(--secondary)] px-3 py-3 text-sm text-[color:var(--foreground)] outline-none"
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
                                className="rounded-2xl border border-[color:var(--border)] bg-[color:var(--secondary)] px-3 py-3 text-sm text-[color:var(--foreground)] outline-none"
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
                                className="rounded-2xl border border-[color:var(--border)] bg-[color:var(--secondary)] px-3 py-3 text-sm text-[color:var(--foreground)] outline-none"
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
                                className="rounded-2xl border border-[color:var(--border)] bg-[color:var(--secondary)] px-3 py-3 text-sm text-[color:var(--foreground)] outline-none"
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
                              className="rounded-2xl border border-[color:var(--border)] bg-[color:var(--secondary)] px-3 py-3 text-sm text-[color:var(--foreground)] outline-none"
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
                                className="rounded-full bg-[#00a884] px-4 py-2 text-sm font-semibold text-[#0b141a] disabled:opacity-60"
                              >
                                {reconciliationPending ? "Saving..." : "Save Counts"}
                              </button>
                            </div>
                            {reconciliationFeedback ? (
                              <p className="text-sm text-[color:var(--muted-foreground)]">{reconciliationFeedback}</p>
                            ) : null}
                          </div>
                        ) : null}
                      </div>
                    </section>
                  ) : null}

                  <section className="panel-shell overflow-hidden">
                    <PanelHeader eyebrow="Ingestion Room" title="Packets visible to ingestion" />
                    <div className="grid gap-4 p-5 md:grid-cols-2 2xl:grid-cols-3">
                      {currentSnapshot.ingestionQueue.map((packet) => (
                        <article
                          key={packet.id}
                          className="rounded-3xl border border-[color:var(--border)] bg-[color:var(--card)] p-4"
                        >
                          <div className="flex items-start justify-between gap-3">
                            <div>
                              <p className="text-[11px] uppercase tracking-[0.18em] text-[color:var(--muted-foreground)]">
                                {packet.packageCode}
                              </p>
                              <h3 className="mt-2 text-lg font-semibold tracking-[-0.03em] text-[color:var(--foreground)]">
                                {packet.teamName}
                              </h3>
                              <p className="mt-1 text-sm text-[color:var(--muted-foreground)]">{packet.factoryName}</p>
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
                              <dd className="font-medium text-[color:var(--foreground)]">{packet.expectedSdCards}</dd>
                            </div>
                          </dl>
                        </article>
                      ))}
                    </div>
                  </section>
                </div>
              ) : null}

              {workspace === "movement" && canViewMovement ? (
                <MovementLedgerPanel movements={currentSnapshot.movementHistory} />
              ) : null}

              {workspace === "merit" && canViewMerit ? (
                <MeritPanel scores={currentSnapshot.meritScores} />
              ) : null}

              {workspace === "inventory" && canViewInventory ? (
                <AdminInventoryPanel
                  initialItems={currentSnapshot.inventoryItems}
                  health={health}
                  session={session}
                />
              ) : null}
            </section>
          )}
        </div>
      </div>
    </main>
  );
}
