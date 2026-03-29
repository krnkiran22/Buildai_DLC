import { getMockOperationsSnapshot } from "@/lib/operations-data";
import type {
  AdminInventoryItem,
  AdminInventoryPatch,
  BackendHealth,
  DashboardSnapshot,
  TicketRecord,
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

function actorHeaders() {
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
    injectionQueue: snapshot.injectionQueue ?? fallback.injectionQueue,
    inventoryItems: snapshot.inventoryItems ?? fallback.inventoryItems,
  };
}

export async function getOperationsSnapshot(): Promise<DashboardSnapshot> {
  if (!API_BASE_URL) {
    return getMockOperationsSnapshot();
  }

  try {
    const response = await fetch(`${API_BASE_URL}/api/v1/dashboard/overview`, {
      cache: "no-store",
      headers: actorHeaders(),
    });

    if (!response.ok) {
      throw new Error(`Dashboard overview returned ${response.status}`);
    }

    const payload = (await response.json()) as ApiEnvelope<Partial<DashboardSnapshot>>;

    if (!payload.success) {
      throw new Error(payload.message ?? "Dashboard overview request failed");
    }

    return normalizeSnapshot(payload.data);
  } catch {
    return getMockOperationsSnapshot();
  }
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
): Promise<AdminInventoryItem | null> {
  if (!API_BASE_URL) {
    return null;
  }

  const response = await fetch(`${API_BASE_URL}/api/v1/admin/inventory/${itemId}`, {
    method: "PATCH",
    headers: {
      "Content-Type": "application/json",
      ...actorHeaders(),
    },
    body: JSON.stringify(patch),
  });

  if (!response.ok) {
    throw new Error(`Inventory update returned ${response.status}`);
  }

  const payload = (await response.json()) as ApiEnvelope<AdminInventoryItem>;

  if (!payload.success) {
    throw new Error(payload.message ?? "Inventory update failed");
  }

  return payload.data;
}

export async function sendTicketMessage(
  ticketId: string,
  message: string,
): Promise<TicketRecord | null> {
  if (!API_BASE_URL) {
    return null;
  }

  const response = await fetch(`${API_BASE_URL}/api/v1/tickets/${ticketId}/messages`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      ...actorHeaders(),
    },
    body: JSON.stringify({ message }),
  });

  if (!response.ok) {
    throw new Error(`Ticket message returned ${response.status}`);
  }

  const payload = (await response.json()) as ApiEnvelope<TicketRecord>;
  if (!payload.success) {
    throw new Error(payload.message ?? "Ticket message failed");
  }
  return payload.data;
}

export async function closeTicket(
  ticketId: string,
  note: string,
): Promise<TicketRecord | null> {
  if (!API_BASE_URL) {
    return null;
  }

  const response = await fetch(`${API_BASE_URL}/api/v1/tickets/${ticketId}/close`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      ...actorHeaders(),
    },
    body: JSON.stringify({ note }),
  });

  if (!response.ok) {
    throw new Error(`Ticket close returned ${response.status}`);
  }

  const payload = (await response.json()) as ApiEnvelope<TicketRecord>;
  if (!payload.success) {
    throw new Error(payload.message ?? "Ticket close failed");
  }
  return payload.data;
}
