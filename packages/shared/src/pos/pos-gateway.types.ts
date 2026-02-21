// ── POS Gateway Request / Response Types ─────────────────────

/** Pre-auth hold on a card */
export interface ProvisionRequest {
  paymentId: string;
  amount: string;
  currency: string;
  idempotencyKey: string;
  cardToken?: string;
  metadata?: Record<string, unknown>;
}

export interface ProvisionResponse {
  success: boolean;
  posReference: string | null;
  message: string;
}

/** Capture a previously provisioned amount */
export interface CaptureProvisionRequest {
  paymentId: string;
  posReference: string;
  amount: string;
  currency: string;
  idempotencyKey: string;
  metadata?: Record<string, unknown>;
}

export interface CaptureProvisionResponse {
  success: boolean;
  posReference: string | null;
  message: string;
}

/** Cancel (release) a provision hold */
export interface CancelProvisionRequest {
  paymentId: string;
  posReference: string;
  idempotencyKey: string;
  metadata?: Record<string, unknown>;
}

export interface CancelProvisionResponse {
  success: boolean;
  message: string;
}

/** Refund a completed payment (full or partial) */
export interface PosRefundRequest {
  paymentId: string;
  posReference: string;
  amount: string;
  currency: string;
  idempotencyKey: string;
  metadata?: Record<string, unknown>;
}

export interface PosRefundResponse {
  success: boolean;
  posRefundReference: string | null;
  message: string;
}
