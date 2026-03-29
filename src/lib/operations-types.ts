export type Tone = "neutral" | "info" | "success" | "warning" | "error";

export type TicketStatus =
  | "open"
  | "accepted"
  | "rejected"
  | "outbound_shipped"
  | "factory_received"
  | "return_shipped"
  | "hq_received"
  | "transferred_to_ingestion"
  | "ingestion_processing"
  | "ingestion_completed"
  | "closed";

export type Priority = "high" | "medium" | "low";
export type InventoryStatus = "healthy" | "low_stock" | "critical";
export type UserRole = "admin" | "logistics" | "factory_operator" | "ingestion";
export type PermissionName =
  | "ticket.view"
  | "ticket.message"
  | "ticket.close"
  | "inventory.view"
  | "inventory.edit";

export type DashboardMetric = {
  label: string;
  value: string;
  helper: string;
  tone: Tone;
};

export type RequestItem = {
  itemType: string;
  requestedQty: number;
  approvedQty: number;
  returnedQty: number;
  receivedAtHqQty: number;
};

export type ChatMessage = {
  id: string;
  author: string;
  role: "admin" | "operator" | "logistics" | "ingestion";
  sentAt: string;
  message: string;
};

export type TimelineEvent = {
  id: string;
  label: string;
  detail: string;
  occurredAt: string;
  actor: string;
  tone: Tone;
};

export type PackageRecord = {
  packageCode: string;
  qrToken: string;
  direction: "outbound" | "return";
  status: TicketStatus;
  itemCount: number;
  note: string;
};

export type IngestionReport = {
  station: string;
  startedAt: string;
  expectedSdCards: number;
  actualSdCardsReceived: number;
  processedSdCards: number;
  missingSdCards: number;
  faultySdCards: number;
  note: string;
};

export type TicketRecord = {
  id: string;
  title: string;
  teamName: string;
  factoryName: string;
  deploymentDate: string;
  workerCount: number;
  status: TicketStatus;
  priority: Priority;
  devicesRequested: number;
  sdCardsRequested: number;
  requestOwner: string;
  summary: string;
  nextAction: string;
  items: RequestItem[];
  packages: PackageRecord[];
  messages: ChatMessage[];
  timeline: TimelineEvent[];
  ingestionReport: IngestionReport | null;
};

export type IngestionQueueItem = {
  id: string;
  packageCode: string;
  teamName: string;
  factoryName: string;
  deploymentDate: string;
  expectedSdCards: number;
  status: TicketStatus;
};

export type AdminInventoryItem = {
  id: string;
  itemType: string;
  sku: string;
  totalUnits: number;
  availableUnits: number;
  allocatedUnits: number;
  inTransitUnits: number;
  ingestionUnits: number;
  missingUnits: number;
  reorderPoint: number;
  location: string;
  updatedBy: string;
  updatedAt: string;
  note: string;
  status: InventoryStatus;
};

export type AdminInventoryPatch = {
  totalUnits?: number;
  availableUnits?: number;
  allocatedUnits?: number;
  inTransitUnits?: number;
  ingestionUnits?: number;
  missingUnits?: number;
  reorderPoint?: number;
  location?: string;
  updatedBy?: string;
  note?: string;
};

export type BackendHealth = {
  ok: boolean;
  service: string;
  environment: string;
  baseUrl: string;
};

export type ViewerContext = {
  role: UserRole;
  name: string;
  permissions: PermissionName[];
};

export type RoleCapability = {
  role: UserRole;
  permissions: PermissionName[];
  closeTickets: boolean;
  editInventory: boolean;
  canChat: boolean;
};

export type DashboardSnapshot = {
  productName: string;
  generatedAt: string;
  viewer: ViewerContext;
  roleMatrix: RoleCapability[];
  metrics: DashboardMetric[];
  tickets: TicketRecord[];
  highlightedTicketId: string;
  ingestionQueue: IngestionQueueItem[];
  inventoryItems: AdminInventoryItem[];
};
