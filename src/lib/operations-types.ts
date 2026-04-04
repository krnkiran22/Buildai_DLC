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
export type TicketType = "deployment" | "transfer";

export type Priority = "high" | "medium" | "low";
export type InventoryStatus = "healthy" | "low_stock" | "critical";
export type UserRole = "admin" | "logistics" | "factory_operator" | "ingestion";
export type PermissionName =
  | "ticket.view"
  | "ticket.message"
  | "ticket.close"
  | "ticket.create"
  | "ticket.status.update"
  | "package.view"
  | "package.edit"
  | "package.status.update"
  | "ingestion.reconcile"
  | "inventory.view"
  | "inventory.edit"
  | "user.manage";

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
  replyToMessageId?: string | null;
  replyToAuthor?: string | null;
  replyToExcerpt?: string | null;
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
  shippedSdCardsCount: number;
  shippedDevicesCount: number;
  shippedUsbHubsCount: number;
  shippedCablesCount: number;
  receivedSdCardsCount?: number | null;
  receivedDevicesCount?: number | null;
  receivedUsbHubsCount?: number | null;
  receivedCablesCount?: number | null;
  note: string;
  teamName?: string | null;
  factoryName?: string | null;
  deploymentDate?: string | null;
  updatedAt?: string | null;
  updatedBy?: string | null;
  firstEditAt?: string | null;
  editWindowExpiresAt?: string | null;
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

export type IngestionRun = {
  id: string;
  ticketId: string;
  runNumber: number;
  qrCode?: string | null;
  packageLabel?: string | null;
  totalInPacket: number;
  goodSdCards: number;
  badSdCards: number;
  missingSdCards: number;
  notes: string;
  processedBy: string;
  processedByName: string;
  processedAt: string;
};

export type IngestionRunCreateInput = {
  qrCode?: string | null;
  packageLabel?: string | null;
  totalInPacket: number;
  goodSdCards: number;
  badSdCards: number;
  missingSdCards: number;
  notes?: string;
  markCompleted?: boolean;
};

export type TicketMember = {
  email: string;
  displayName: string;
  role: string;
  addedAt: string;
  addedBy: string;
};

export type TicketRecord = {
  id: string;
  title: string;
  ticketType: TicketType;
  teamName: string;
  factoryName: string;
  sourceTeamName?: string | null;
  sourceFactoryName?: string | null;
  linkedTicketId?: string | null;
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
  ingestionRuns: IngestionRun[];
  members: TicketMember[];
  assignedToEmail?: string | null;
  assignedToName?: string | null;
};

export type UserProfile = {
  id: string;
  email: string;
  displayName: string;
  role: string;
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

export type MeritScore = {
  teamName: string;
  score: number;
  sdCardPenalty: number;
  devicePenalty: number;
  accessoryPenalty: number;
  sdCardShortfall: number;
  deviceShortfall: number;
  accessoryShortfall: number;
  updatedAt: string;
};

export type MovementRecord = {
  id: string;
  ticketId: string;
  ticketType: TicketType;
  status: TicketStatus;
  sourceLabel: string;
  destinationLabel: string;
  routePath: string[];
  routeSummary: string;
  relatedTicketId?: string | null;
  devicesCount: number;
  sdCardsCount: number;
  usbHubsCount: number;
  cablesCount: number;
  packageCount: number;
  lastEventAt: string;
  note: string;
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
  dependencies?: Record<string, { configured: boolean; ready: boolean }>;
};

export type ViewerContext = {
  userId?: string | null;
  role: UserRole;
  name: string;
  email?: string | null;
  permissions: PermissionName[];
};

export type RoleCapability = {
  role: UserRole;
  permissions: PermissionName[];
  closeTickets: boolean;
  editInventory: boolean;
  canChat: boolean;
  canCreateTickets: boolean;
  canUpdateStatus: boolean;
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
  meritScores: MeritScore[];
  movementHistory: MovementRecord[];
};

export type AuthUser = {
  id: string;
  email: string;
  displayName: string;
  role: UserRole;
  isActive: boolean;
  createdAt: string;
};

export type AuthSession = {
  token: string;
  expiresAt: string;
  user: AuthUser;
  permissions: PermissionName[];
};

export type RegistrationChallenge = {
  email: string;
  role: UserRole;
  expiresAt: string;
  deliveryMode: "email" | "development_log";
  otpDebugCode?: string | null;
};

export type QrPackageDetail = {
  ticketId: string;
  title: string;
  teamName: string;
  factoryName: string;
  deploymentDate: string;
  package: PackageRecord;
  scanUrl: string;
  qrSvgPath: string;
  editable: boolean;
  publicAccess: boolean;
  editWindowExpiresAt?: string | null;
  lockedReason?: string | null;
};

export type TicketCreateInput = {
  ticketType: TicketType;
  teamName: string;
  factoryName: string;
  sourceTeamName?: string;
  sourceFactoryName?: string;
  linkedTicketId?: string;
  deploymentDate: string;
  workerCount: number;
  devicesRequested: number;
  sdCardsRequested: number;
  priority: Priority;
  title?: string;
};

export type TicketStatusUpdateInput = {
  status: TicketStatus;
  note?: string;
};

export type PackageCreateInput = {
  direction: "outbound" | "return";
  itemCount: number;
  shippedSdCardsCount: number;
  shippedDevicesCount: number;
  shippedUsbHubsCount: number;
  shippedCablesCount: number;
  note: string;
};

export type PackageBatchCreateInput = {
  labelCount: number;
  shippedSdCardsCount: number;
  shippedDevicesCount: number;
  shippedUsbHubsCount: number;
  shippedCablesCount: number;
  note: string;
};

export type PublicQrPackagePatch = {
  teamName?: string;
  factoryName?: string;
  deploymentDate?: string;
  receivedSdCardsCount?: number;
  receivedDevicesCount?: number;
  receivedUsbHubsCount?: number;
  receivedCablesCount?: number;
  note?: string;
};

export type PackageStatusUpdateInput = {
  status: TicketStatus;
  note?: string;
};

export type IngestionReconciliationInput = {
  station: string;
  expectedSdCards: number;
  actualSdCardsReceived: number;
  processedSdCards: number;
  missingSdCards: number;
  faultySdCards: number;
  note: string;
  startedAt?: string;
  markCompleted?: boolean;
};

export type LiveTicketEvent = {
  ticketId: string;
  eventType: string;
  occurredAt?: string | null;
  actor?: string;
  role?: UserRole | ChatMessage["role"];
  status?: TicketStatus;
  detail?: string;
  note?: string;
  ticket?: TicketRecord;
  package?: PackageRecord;
  ingestionReport?: IngestionReport;
  messageRecord?: {
    id: string;
    author: string;
    role: ChatMessage["role"];
    sentAt?: string;
    sent_at?: string;
    message: string;
    replyToMessageId?: string | null;
    reply_to_message_id?: string | null;
    replyToAuthor?: string | null;
    reply_to_author?: string | null;
    replyToExcerpt?: string | null;
    reply_to_excerpt?: string | null;
  };
  timelineEvent?: TimelineEvent;
  viewer?: ViewerContext;
};
