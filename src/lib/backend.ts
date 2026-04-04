import { getMockOperationsSnapshot } from "@/lib/operations-data";
import type {
  AdminInventoryItem,
  AdminInventoryPatch,
  AuthSession,
  BackendHealth,
  DashboardSnapshot,
  IngestionReconciliationInput,
  LiveTicketEvent,
  PackageBatchCreateInput,
  PackageCreateInput,
  PublicQrPackagePatch,
  PackageStatusUpdateInput,
  QrPackageDetail,
  RegistrationChallenge,
  TicketCreateInput,
  TicketRecord,
  TicketStatusUpdateInput,
} from "@/lib/operations-types";

type ApiEnvelope<T> = {
  success: boolean;
  message?: string;
  data: T;
};

type ApiValidationIssue = {
  loc?: Array<string | number>;
  msg?: string;
  type?: string;
  ctx?: Record<string, unknown>;
};

const PROD_API_BASE_URL =
  process.env.NEXT_PUBLIC_OPERATIONS_PROD_API_BASE_URL?.replace(/\/+$/, "") ??
  "https://marvelous-consideration-production.up.railway.app";
const API_BASE_URL =
  process.env.NEXT_PUBLIC_OPERATIONS_API_BASE_URL?.replace(/\/+$/, "") || PROD_API_BASE_URL;
const PROD_HEALTH_BASE_URL =
  process.env.NEXT_PUBLIC_OPERATIONS_PROD_HEALTH_URL?.replace(/\/+$/, "") ??
  PROD_API_BASE_URL;
const ACTOR_ROLE = process.env.NEXT_PUBLIC_ACTOR_ROLE ?? "admin";
const ACTOR_NAME = process.env.NEXT_PUBLIC_ACTOR_NAME ?? "Admin Console";

function apiBaseUrl() {
  return API_BASE_URL;
}

const API_ERROR_FIELD_LABELS: Record<string, string> = {
  email: "Email",
  password: "Password",
  display_name: "Display name",
  display_name_input: "Display name",
  otp: "OTP code",
  role: "Role",
  label_count: "QR label count",
  packages: "QR label",
  note: "Note",
  team_name: "Team name",
  factory_name: "Factory name",
  deployment_date: "Deployment date",
  worker_count: "Worker count",
  devices_requested: "Requested device count",
  sd_cards_requested: "Requested SD card count",
  shipped_sd_cards_count: "Shipped SD card count",
  shipped_devices_count: "Shipped device count",
  shipped_usb_hubs_count: "Shipped USB hub count",
  shipped_cables_count: "Shipped cable count",
  received_sd_cards_count: "Received SD card count",
  received_devices_count: "Received device count",
  received_usb_hubs_count: "Received USB hub count",
  received_cables_count: "Received cable count",
};

function normalizeFieldKey(value: string) {
  return value
    .replace(/([a-z0-9])([A-Z])/g, "$1_$2")
    .replace(/[-\s]+/g, "_")
    .toLowerCase();
}

function humanizeFieldName(value: string) {
  const normalized = normalizeFieldKey(value);
  return API_ERROR_FIELD_LABELS[normalized] ?? normalized.replace(/_/g, " ").replace(/^\w/, (char) => char.toUpperCase());
}

function formatValidationLocation(loc?: Array<string | number>) {
  if (!Array.isArray(loc)) {
    return "";
  }

  const parts: string[] = [];
  for (const part of loc) {
    if (typeof part === "string" && ["body", "query", "path", "header", "cookie"].includes(part)) {
      continue;
    }
    if (typeof part === "number") {
      if (parts.length > 0) {
        parts[parts.length - 1] = `${parts[parts.length - 1]} ${part + 1}`;
      } else {
        parts.push(`Item ${part + 1}`);
      }
      continue;
    }
    parts.push(humanizeFieldName(part));
  }

  return parts.join(" ").trim();
}

function formatValidationIssue(issue: ApiValidationIssue) {
  const fieldName = formatValidationLocation(issue.loc);
  const errorType = issue.type ?? "";
  const context = issue.ctx ?? {};

  if (errorType === "missing") {
    return `${fieldName || "Field"} is required.`;
  }
  if (errorType === "string_too_short" && typeof context.min_length === "number" && fieldName) {
    return `${fieldName} must be at least ${context.min_length} characters.`;
  }
  if (errorType === "string_too_long" && typeof context.max_length === "number" && fieldName) {
    return `${fieldName} must be ${context.max_length} characters or less.`;
  }
  if (errorType === "greater_than_equal" && typeof context.ge === "number" && fieldName) {
    return `${fieldName} must be ${context.ge} or more.`;
  }
  if (errorType === "less_than_equal" && typeof context.le === "number" && fieldName) {
    return `${fieldName} must be ${context.le} or less.`;
  }

  if (fieldName && issue.msg) {
    return `${fieldName}: ${issue.msg}`;
  }
  return issue.msg ?? "Request failed.";
}

function extractApiErrorMessage(payload: unknown, status: number) {
  if (!payload || typeof payload !== "object") {
    return `Request failed with ${status}`;
  }

  const detail = (payload as { detail?: unknown }).detail;
  if (typeof detail === "string" && detail.trim()) {
    return detail;
  }
  if (Array.isArray(detail)) {
    const messages = detail
      .map((issue) => formatValidationIssue(issue as ApiValidationIssue))
      .filter(Boolean);
    if (messages.length > 0) {
      return messages.join(" ");
    }
  }

  const errors = (payload as { errors?: unknown }).errors;
  if (Array.isArray(errors)) {
    const messages = errors
      .map((issue) =>
        typeof issue === "string" ? issue : formatValidationIssue(issue as ApiValidationIssue),
      )
      .filter(Boolean);
    if (messages.length > 0) {
      return messages.join(" ");
    }
  }

  const message = (payload as { message?: unknown }).message;
  if (typeof message === "string" && message.trim()) {
    return message;
  }

  return `Request failed with ${status}`;
}

function websocketBaseUrl() {
  if (!API_BASE_URL) {
    return "";
  }

  const url = new URL(API_BASE_URL);
  url.protocol = url.protocol === "https:" ? "wss:" : "ws:";
  return url.toString().replace(/\/+$/, "");
}

function requestHeaders(session?: AuthSession | null): HeadersInit {
  if (session?.token) {
    return {
      Authorization: `Bearer ${session.token}`,
    };
  }

  return {
    "X-Actor-Role": ACTOR_ROLE,
    "X-Actor-Name": ACTOR_NAME,
  };
}

function publicRequestHeaders(): HeadersInit {
  return {};
}

function normalizeSnapshot(
  snapshot: Partial<DashboardSnapshot> | undefined,
): DashboardSnapshot {
  const fallback = getMockOperationsSnapshot();

  if (!snapshot) {
    return fallback;
  }

  return {
    ...fallback,
    ...snapshot,
    viewer: snapshot.viewer ?? fallback.viewer,
    roleMatrix: snapshot.roleMatrix ?? fallback.roleMatrix,
    metrics: snapshot.metrics ?? fallback.metrics,
    tickets: snapshot.tickets ?? fallback.tickets,
    ingestionQueue: snapshot.ingestionQueue ?? fallback.ingestionQueue,
    inventoryItems: snapshot.inventoryItems ?? fallback.inventoryItems,
    meritScores: snapshot.meritScores ?? fallback.meritScores,
    movementHistory: snapshot.movementHistory ?? fallback.movementHistory,
  };
}

export class SessionExpiredError extends Error {
  constructor() {
    super("SESSION_EXPIRED");
    this.name = "SessionExpiredError";
  }
}

export function isSessionExpiredError(err: unknown): boolean {
  return (
    err instanceof SessionExpiredError ||
    (err instanceof Error && err.message === "SESSION_EXPIRED")
  );
}

async function requestJson<T>(
  path: string,
  init?: RequestInit,
): Promise<T> {
  if (!API_BASE_URL) {
    throw new Error("Backend API base URL is not configured.");
  }

  const response = await fetch(`${API_BASE_URL}${path}`, {
    cache: "no-store",
    ...init,
  });

  // 401 = token missing/expired → session expired
  // 403 = authenticated but insufficient permission → show the backend's error message
  if (response.status === 401) {
    throw new SessionExpiredError();
  }
  if (response.status === 403) {
    const payload = await response.json().catch(() => null);
    const msg = extractApiErrorMessage(payload, 403);
    throw new Error(msg || "You don't have permission to do that.");
  }

  if (!response.ok) {
    const payload = await response.json().catch(() => null);
    throw new Error(extractApiErrorMessage(payload, response.status));
  }

  const payload = (await response.json()) as ApiEnvelope<T>;
  if (!payload.success) {
    throw new Error(payload.message ?? "Request failed");
  }
  return payload.data;
}

export function isApiConfigured() {
  return Boolean(API_BASE_URL);
}

export async function getOperationsSnapshot(
  session?: AuthSession | null,
): Promise<DashboardSnapshot> {
  if (!API_BASE_URL) {
    return getMockOperationsSnapshot();
  }

  try {
    const data = await requestJson<Partial<DashboardSnapshot>>("/api/v1/dashboard/overview", {
      headers: requestHeaders(session),
    });
    return normalizeSnapshot(data);
  } catch {
    return getMockOperationsSnapshot();
  }
}

export async function getCurrentSession(session: AuthSession): Promise<AuthSession> {
  return requestJson<AuthSession>("/api/v1/auth/me", {
    headers: requestHeaders(session),
  });
}

export async function logoutCurrentSession(session: AuthSession): Promise<void> {
  if (!API_BASE_URL) {
    return;
  }

  await requestJson<{ loggedOut: boolean }>("/api/v1/auth/logout", {
    method: "POST",
    headers: requestHeaders(session),
  });
}

export async function getBackendHealth(): Promise<BackendHealth> {
  const baseUrl = API_BASE_URL || PROD_HEALTH_BASE_URL;

  try {
    const response = await fetch(`${baseUrl}/health`, {
      cache: "no-store",
    });

    if (!response.ok) {
      throw new Error(`Health returned ${response.status}`);
    }

    const payload = (await response.json()) as Omit<BackendHealth, "baseUrl">;
    return {
      ...payload,
      baseUrl,
    };
  } catch {
    return {
      ok: false,
      service: "DLC Service API",
      environment: "unknown",
      baseUrl,
    };
  }
}

export async function updateAdminInventoryItem(
  itemId: string,
  patch: AdminInventoryPatch,
  session?: AuthSession | null,
): Promise<AdminInventoryItem | null> {
  if (!API_BASE_URL) {
    return null;
  }

  return requestJson<AdminInventoryItem>(`/api/v1/admin/inventory/${itemId}`, {
    method: "PATCH",
    headers: {
      "Content-Type": "application/json",
      ...requestHeaders(session),
    },
    body: JSON.stringify(patch),
  });
}

export async function sendTicketMessage(
  ticketId: string,
  message: string,
  replyToMessageId?: string | null,
  session?: AuthSession | null,
): Promise<TicketRecord | null> {
  if (!API_BASE_URL) {
    return null;
  }

  return requestJson<TicketRecord>(`/api/v1/tickets/${ticketId}/messages`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      ...requestHeaders(session),
    },
    body: JSON.stringify({
      message,
      replyToMessageId: replyToMessageId ?? undefined,
    }),
  });
}

export async function closeTicket(
  ticketId: string,
  note: string,
  session?: AuthSession | null,
): Promise<TicketRecord | null> {
  if (!API_BASE_URL) {
    return null;
  }

  return requestJson<TicketRecord>(`/api/v1/tickets/${ticketId}/close`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      ...requestHeaders(session),
    },
    body: JSON.stringify({ note }),
  });
}

export async function createTicket(
  payload: TicketCreateInput,
  session?: AuthSession | null,
): Promise<TicketRecord | null> {
  if (!API_BASE_URL) {
    return null;
  }

  return requestJson<TicketRecord>("/api/v1/tickets", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      ...requestHeaders(session),
    },
    body: JSON.stringify(payload),
  });
}

export async function updateTicketStatus(
  ticketId: string,
  payload: TicketStatusUpdateInput,
  session?: AuthSession | null,
): Promise<TicketRecord | null> {
  if (!API_BASE_URL) {
    return null;
  }

  return requestJson<TicketRecord>(`/api/v1/tickets/${ticketId}/status`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      ...requestHeaders(session),
    },
    body: JSON.stringify(payload),
  });
}

export async function createTicketPackage(
  ticketId: string,
  payload: PackageCreateInput,
  session?: AuthSession | null,
): Promise<TicketRecord | null> {
  if (!API_BASE_URL) {
    return null;
  }

  return requestJson<TicketRecord>(`/api/v1/tickets/${ticketId}/packages`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      ...requestHeaders(session),
    },
    body: JSON.stringify(payload),
  });
}

export async function createTicketPackagesBatch(
  ticketId: string,
  payload: PackageBatchCreateInput,
  session?: AuthSession | null,
): Promise<TicketRecord | null> {
  if (!API_BASE_URL) {
    return null;
  }

  return requestJson<TicketRecord>(`/api/v1/tickets/${ticketId}/packages/batch`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      ...requestHeaders(session),
    },
    body: JSON.stringify(payload),
  });
}

export async function updateTicketPackageStatus(
  ticketId: string,
  packageCode: string,
  payload: PackageStatusUpdateInput,
  session?: AuthSession | null,
): Promise<TicketRecord | null> {
  if (!API_BASE_URL) {
    return null;
  }

  return requestJson<TicketRecord>(`/api/v1/tickets/${ticketId}/packages/${packageCode}/status`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      ...requestHeaders(session),
    },
    body: JSON.stringify(payload),
  });
}

export async function getQrPackageDetail(
  qrToken: string,
  session?: AuthSession | null,
): Promise<QrPackageDetail | null> {
  if (!API_BASE_URL) {
    return null;
  }

  return requestJson<QrPackageDetail>(`/api/v1/qr/${qrToken}`, {
    headers: session ? requestHeaders(session) : publicRequestHeaders(),
  });
}

export async function updateQrPackageDetail(
  qrToken: string,
  payload: PublicQrPackagePatch,
  session?: AuthSession | null,
): Promise<QrPackageDetail | null> {
  if (!API_BASE_URL) {
    return null;
  }

  return requestJson<QrPackageDetail>(`/api/v1/qr/${qrToken}`, {
    method: "PATCH",
    headers: {
      "Content-Type": "application/json",
      ...(session ? requestHeaders(session) : publicRequestHeaders()),
    },
    body: JSON.stringify(payload),
  });
}

export async function saveIngestionReconciliation(
  ticketId: string,
  payload: IngestionReconciliationInput,
  session?: AuthSession | null,
): Promise<TicketRecord | null> {
  if (!API_BASE_URL) {
    return null;
  }

  return requestJson<TicketRecord>(`/api/v1/tickets/${ticketId}/ingestion/reconciliation`, {
    method: "PUT",
    headers: {
      "Content-Type": "application/json",
      ...requestHeaders(session),
    },
    body: JSON.stringify(payload),
  });
}

export async function requestRegistrationOtp(payload: {
  email: string;
  password: string;
  displayName: string;
  role: "factory_operator" | "ingestion";
}): Promise<RegistrationChallenge> {
  return requestJson<RegistrationChallenge>("/api/v1/auth/register/request-otp", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
    },
    body: JSON.stringify(payload),
  });
}

export async function verifyRegistrationOtp(payload: {
  email: string;
  otp: string;
}): Promise<AuthSession> {
  return requestJson<AuthSession>("/api/v1/auth/register/verify-otp", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
    },
    body: JSON.stringify(payload),
  });
}

export async function loginUser(payload: {
  email: string;
  password: string;
}): Promise<AuthSession> {
  return requestJson<AuthSession>("/api/v1/auth/login", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
    },
    body: JSON.stringify(payload),
  });
}

/* ── Ticket Assignment ───────────────────────────────────────────── */

export async function claimTicket(
  ticketId: string,
  session: AuthSession,
): Promise<import("@/lib/operations-types").TicketRecord | null> {
  return requestJson<import("@/lib/operations-types").TicketRecord>(
    `/api/v1/tickets/${encodeURIComponent(ticketId)}/claim`,
    { method: "POST", headers: requestHeaders(session) },
  );
}

/* ── Ticket Members ──────────────────────────────────────────────── */

export async function lookupUserByEmail(
  email: string,
  session: AuthSession,
): Promise<import("@/lib/operations-types").UserProfile | null> {
  try {
    return await requestJson<import("@/lib/operations-types").UserProfile>(
      `/api/v1/tickets/users/lookup?email=${encodeURIComponent(email)}`,
      { headers: requestHeaders(session) },
    );
  } catch {
    return null;
  }
}

export async function addTicketMember(
  ticketId: string,
  email: string,
  session: AuthSession,
): Promise<import("@/lib/operations-types").TicketRecord | null> {
  return requestJson<import("@/lib/operations-types").TicketRecord>(
    `/api/v1/tickets/${encodeURIComponent(ticketId)}/members`,
    {
      method: "POST",
      headers: { ...requestHeaders(session), "Content-Type": "application/json" },
      body: JSON.stringify({ email }),
    },
  );
}

export async function removeTicketMember(
  ticketId: string,
  email: string,
  session: AuthSession,
): Promise<import("@/lib/operations-types").TicketRecord | null> {
  return requestJson<import("@/lib/operations-types").TicketRecord>(
    `/api/v1/tickets/${encodeURIComponent(ticketId)}/members/${encodeURIComponent(email)}`,
    { method: "DELETE", headers: requestHeaders(session) },
  );
}

export function qrSvgUrl(qrToken: string) {
  if (!API_BASE_URL) {
    return "";
  }
  return `${API_BASE_URL}/api/v1/qr/${encodeURIComponent(qrToken)}/svg`;
}

export function ticketStreamUrl(ticketId: string, session: AuthSession | null) {
  if (!session?.token || !API_BASE_URL) {
    return null;
  }
  return `${websocketBaseUrl()}/api/v1/tickets/${encodeURIComponent(ticketId)}/stream?token=${encodeURIComponent(session.token)}`;
}

export type TicketStreamHandler = (event: LiveTicketEvent) => void;

type TicketStreamOptions = {
  onAuthExpired?: () => void;
};

/**
 * Opens a live WebSocket stream for a ticket.
 * Automatically reconnects with exponential backoff on unexpected close.
 * Calls onAuthExpired() if the server rejects the token (close code 4001/4003/1008).
 * Returns a controller object with a `close()` method.
 */
export function openTicketStream(
  ticketId: string,
  session: AuthSession,
  onEvent: TicketStreamHandler,
  options: TicketStreamOptions = {},
): { close: () => void } | null {
  if (typeof window === "undefined") return null;

  const streamUrl = ticketStreamUrl(ticketId, session);
  if (!streamUrl) return null;

  let socket: WebSocket | null = null;
  let destroyed = false;
  let retryCount = 0;
  const MAX_RETRIES = 6;
  let retryTimer: ReturnType<typeof setTimeout> | null = null;

  function connect() {
    if (destroyed) return;

    socket = new window.WebSocket(streamUrl!);

    socket.onopen = () => {
      retryCount = 0; // reset backoff on successful connection
    };

    socket.onmessage = (ev) => {
      try {
        onEvent(JSON.parse(ev.data as string) as LiveTicketEvent);
      } catch {
        // ignore malformed events
      }
    };

    socket.onerror = () => {
      // onerror is always followed by onclose, handle there
    };

    socket.onclose = (ev) => {
      if (destroyed) return;

      // Auth rejection codes
      const isAuthError = ev.code === 4001 || ev.code === 4003 || ev.code === 1008;
      if (isAuthError) {
        options.onAuthExpired?.();
        return;
      }

      // Normal / intentional close (1000, 1001) — don't reconnect
      if (ev.code === 1000 || ev.code === 1001) return;

      // Unexpected close — reconnect with exponential backoff
      if (retryCount < MAX_RETRIES) {
        const delay = Math.min(1000 * 2 ** retryCount, 30000);
        retryCount++;
        retryTimer = setTimeout(connect, delay);
      }
    };
  }

  connect();

  return {
    close() {
      destroyed = true;
      if (retryTimer) clearTimeout(retryTimer);
      if (socket && socket.readyState === WebSocket.OPEN) {
        socket.close(1000, "component unmounted");
      }
      socket = null;
    },
  };
}

export { apiBaseUrl };
