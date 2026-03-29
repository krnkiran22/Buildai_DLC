import { getMockOperationsSnapshot } from "@/lib/operations-data";
import type {
  AdminInventoryItem,
  AdminInventoryPatch,
  AuthSession,
  BackendHealth,
  DashboardSnapshot,
  IngestionReconciliationInput,
  LiveTicketEvent,
  PackageCreateInput,
  PackageMetadataPatch,
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

const API_BASE_URL =
  process.env.NEXT_PUBLIC_OPERATIONS_API_BASE_URL?.replace(/\/+$/, "") ?? "";
const PROD_HEALTH_BASE_URL =
  process.env.NEXT_PUBLIC_OPERATIONS_PROD_HEALTH_URL?.replace(/\/+$/, "") ??
  "https://marvelous-consideration-production.up.railway.app";
const ACTOR_ROLE = process.env.NEXT_PUBLIC_ACTOR_ROLE ?? "admin";
const ACTOR_NAME = process.env.NEXT_PUBLIC_ACTOR_NAME ?? "Admin Console";

function apiBaseUrl() {
  return API_BASE_URL;
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
  };
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

  if (!response.ok) {
    const payload = await response.json().catch(() => null);
    const detail =
      payload?.detail || payload?.message || `Request failed with ${response.status}`;
    throw new Error(detail);
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
    body: JSON.stringify({ message }),
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
    headers: requestHeaders(session),
  });
}

export async function updateQrPackageDetail(
  qrToken: string,
  payload: PackageMetadataPatch,
  session?: AuthSession | null,
): Promise<QrPackageDetail | null> {
  if (!API_BASE_URL) {
    return null;
  }

  return requestJson<QrPackageDetail>(`/api/v1/qr/${qrToken}`, {
    method: "PATCH",
    headers: {
      "Content-Type": "application/json",
      ...requestHeaders(session),
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

export function openTicketStream(
  ticketId: string,
  session: AuthSession,
  onEvent: TicketStreamHandler,
) {
  const streamUrl = ticketStreamUrl(ticketId, session);
  if (!streamUrl || typeof window === "undefined") {
    return null;
  }

  const socket = new window.WebSocket(streamUrl);
  socket.onmessage = (event) => {
    try {
      onEvent(JSON.parse(event.data) as LiveTicketEvent);
    } catch {
      // Ignore malformed stream events.
    }
  };
  return socket;
}

export { apiBaseUrl };
