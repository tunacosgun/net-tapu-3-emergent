import {
  ProvisionRequest,
  ProvisionResponse,
  ProvisionInitiationResponse,
  CompleteProvisionRequest,
  TransactionStatusResponse,
  CaptureProvisionRequest,
  CaptureProvisionResponse,
  CancelProvisionRequest,
  CancelProvisionResponse,
  PosRefundRequest,
  PosRefundResponse,
} from './pos-gateway.types';

/**
 * Abstraction over virtual POS providers (PayTR, Iyzico, Moka).
 *
 * Flow:
 *   Non-3DS:  provision (pre-auth) → capture / cancelProvision
 *   3DS:      initiateProvision → [3DS redirect] → completeProvision → capture / cancelProvision
 *   Refund:   completed payment → refund
 */
export interface IPosGateway {
  /**
   * Initiate a provision (pre-auth). May return immediately (non-3DS)
   * or require a 3DS redirect (status = 'requires_3ds').
   */
  initiateProvision(req: ProvisionRequest): Promise<ProvisionInitiationResponse>;

  /**
   * Complete a provision after 3DS callback.
   * Called when the provider sends the callback/webhook.
   */
  completeProvision(req: CompleteProvisionRequest): Promise<ProvisionResponse>;

  /**
   * Verify a callback/webhook signature from the provider.
   * Returns true if the signature is valid.
   */
  verifyCallback(headers: Record<string, string>, body: Record<string, unknown>): boolean;

  /** Capture a previously provisioned amount (server-to-server, no 3DS) */
  capture(req: CaptureProvisionRequest): Promise<CaptureProvisionResponse>;

  /** Cancel (release) a provision hold */
  cancelProvision(req: CancelProvisionRequest): Promise<CancelProvisionResponse>;

  /** Refund a completed payment (full or partial) */
  refund(req: PosRefundRequest): Promise<PosRefundResponse>;

  /**
   * Query provider for current transaction status (for reconciliation).
   * Optional — not all providers support this.
   */
  queryTransactionStatus?(posReference: string): Promise<TransactionStatusResponse>;

  /**
   * @deprecated Use initiateProvision() + completeProvision() for 3DS support.
   * Kept for backward compatibility — delegates to initiateProvision() internally.
   */
  provision(req: ProvisionRequest): Promise<ProvisionResponse>;
}

/** DI token for IPosGateway */
export const POS_GATEWAY = Symbol('POS_GATEWAY');
