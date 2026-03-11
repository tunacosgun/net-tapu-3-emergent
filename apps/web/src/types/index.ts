export interface LoginResponse {
  accessToken: string;
  refreshToken: string;
  expiresIn: number;
}

export interface JwtPayload {
  sub: string;
  email: string;
  roles: string[];
  iat: number;
  exp: number;
}

export interface Parcel {
  id: string;
  listingId: string;
  title: string;
  description: string | null;
  status: string;
  city: string;
  district: string;
  neighborhood: string | null;
  address: string | null;
  latitude: string | null;
  longitude: string | null;
  ada: string | null;
  parsel: string | null;
  areaM2: string | null;
  zoningStatus: string | null;
  landType: string | null;
  price: string | null;
  pricePerM2: string | null;
  currency: string;
  isAuctionEligible: boolean;
  isFeatured: boolean;
  createdBy: string | null;
  assignedConsultant: string | null;
  listedAt: string | null;
  createdAt: string;
  updatedAt: string;
  favoriteCount?: number;
  viewerCount?: number;
  images?: ParcelImage[];
}

export interface ParcelImage {
  id: string;
  parcelId: string;
  originalUrl: string;
  watermarkedUrl: string | null;
  thumbnailUrl: string | null;
  status: string;
  sortOrder: number;
  isCover: boolean;
  fileSizeBytes: number | null;
  mimeType: string | null;
  /** @deprecated use originalUrl */
  url: string;
  caption: string | null;
  displayOrder: number;
}

export interface Auction {
  id: string;
  parcelId: string;
  title: string;
  description: string | null;
  status: string;
  startingPrice: string;
  currentPrice: string;
  minimumIncrement: string;
  requiredDeposit: string;
  currency: string;
  finalPrice: string | null;
  winnerId: string | null;
  depositDeadline: string;
  scheduledStart: string;
  scheduledEnd: string;
  actualStart: string | null;
  endedAt: string | null;
  extendedUntil: string | null;
  extensionCount: number;
  bidCount: number;
  participantCount: number;
  watcherCount: number;
  createdAt: string;
  updatedAt: string;
  version: number;
}

export interface Deposit {
  id: string;
  userId: string;
  auctionId: string;
  amount: string;
  currency: string;
  status: 'collected' | 'held' | 'captured' | 'refund_pending' | 'refunded' | 'expired';
  paymentMethod: string;
  posProvider: string | null;
  idempotencyKey: string;
  createdAt: string;
  updatedAt: string;
}

export interface Payment {
  id: string;
  userId: string;
  parcelId: string | null;
  auctionId: string | null;
  amount: string;
  currency: string;
  status: string;
  paymentMethod: string;
  description: string | null;
  idempotencyKey: string;
  posTransactionToken: string | null;
  threeDsRedirectUrl: string | null;
  createdAt: string;
  updatedAt: string;
}

export interface ContactRequest {
  id: string;
  type: 'call_me' | 'parcel_inquiry' | 'general';
  status: 'new' | 'assigned' | 'in_progress' | 'completed' | 'cancelled';
  userId: string | null;
  parcelId: string | null;
  name: string;
  phone: string;
  email: string | null;
  message: string | null;
  assignedTo: string | null;
  createdAt: string;
  updatedAt: string;
  parcel: { title: string; listingId: string; city: string; district: string; price: string | null } | null;
  user: { firstName: string; lastName: string; email: string } | null;
  assignee: { firstName: string; lastName: string } | null;
}

export interface UserActivity {
  action: string;
  resourceType: string | null;
  resourceId: string | null;
  metadata: Record<string, unknown> | null;
  createdAt: string;
}

export interface ActivitySummary {
  firstVisit: string | null;
  lastVisit: string | null;
  totalActions: string;
  parcelsViewed: string;
}

export interface Appointment {
  id: string;
  userId: string | null;
  parcelId: string | null;
  consultantId: string | null;
  contactRequestId: string | null;
  scheduledAt: string;
  durationMinutes: number;
  location: string | null;
  notes: string | null;
  status: 'scheduled' | 'confirmed' | 'completed' | 'cancelled' | 'no_show';
  createdAt: string;
  updatedAt: string;
}

export interface Offer {
  id: string;
  userId: string;
  parcelId: string;
  amount: string;
  currency: string;
  status: 'pending' | 'accepted' | 'rejected' | 'countered' | 'expired' | 'withdrawn';
  message: string | null;
  expiresAt: string | null;
  createdAt: string;
  updatedAt: string;
}

export interface OfferResponse {
  id: string;
  offerId: string;
  respondedBy: string;
  responseType: 'accept' | 'reject' | 'counter';
  counterAmount: string | null;
  message: string | null;
  createdAt: string;
}

export interface StaleRecord {
  id: string;
  amount: string;
  currency: string;
  status: string;
  staleSinceMinutes: number;
}

export interface ReconciliationReport {
  generatedAt: string;
  thresholdMinutes: number;
  stalePendingPayments: (StaleRecord & { userId: string; parcelId: string | null })[];
  stalePendingRefunds: (StaleRecord & { paymentId: string | null; reason: string })[];
}

export interface SettlementManifest {
  manifest_id: string;
  auction_id: string;
  status: string;
  items_total: number;
  items_acknowledged: number;
  created_at: string;
  completed_at: string | null;
}

// ── CMS ─────────────────────────────────────────────────────────────────

export interface CmsPage {
  id: string;
  pageType: string;
  slug: string;
  title: string;
  content: string | null;
  metaTitle: string | null;
  metaDescription: string | null;
  status: string;
  sortOrder: number;
  publishedAt: string | null;
  createdAt: string;
  updatedAt: string;
}

export interface Faq {
  id: string;
  question: string;
  answer: string;
  category: string | null;
  sortOrder: number;
  isPublished: boolean;
  createdAt: string;
}

export interface Reference {
  id: string;
  title: string;
  description: string | null;
  imageUrl: string | null;
  websiteUrl: string | null;
  referenceType: string;
  sortOrder: number;
  isPublished: boolean;
  createdAt: string;
}

export interface ApiError {
  statusCode: number;
  message: string | string[];
  error?: string;
}

export interface PaginatedResponse<T> {
  data: T[];
  meta: {
    total: number;
    page: number;
    limit: number;
    totalPages: number;
  };
}
