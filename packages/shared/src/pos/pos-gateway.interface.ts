import {
  ProvisionRequest,
  ProvisionResponse,
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
 * Flow: provision (pre-auth) → capture / cancelProvision
 *       completed payment   → refund
 */
export interface IPosGateway {
  provision(req: ProvisionRequest): Promise<ProvisionResponse>;
  capture(req: CaptureProvisionRequest): Promise<CaptureProvisionResponse>;
  cancelProvision(req: CancelProvisionRequest): Promise<CancelProvisionResponse>;
  refund(req: PosRefundRequest): Promise<PosRefundResponse>;
}

/** DI token for IPosGateway */
export const POS_GATEWAY = Symbol('POS_GATEWAY');
