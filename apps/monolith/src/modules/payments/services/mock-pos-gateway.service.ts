import { Injectable, Logger } from '@nestjs/common';
import {
  IPosGateway,
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
} from '@nettapu/shared';

const LATENCY_MIN_MS = 50;
const LATENCY_MAX_MS = 200;

/** Amounts above this threshold require 3DS verification (realistic POS behavior) */
const THREE_DS_THRESHOLD_AMOUNT = 100;

@Injectable()
export class MockPosGateway implements IPosGateway {
  private readonly logger = new Logger(MockPosGateway.name);
  private readonly completedTokens = new Set<string>();
  private readonly issuedTokens = new Set<string>();

  async initiateProvision(req: ProvisionRequest): Promise<ProvisionInitiationResponse> {
    this.logger.debug(
      JSON.stringify({
        event: 'mock_pos_initiate_provision',
        payment_id: req.paymentId,
        amount: req.amount,
        currency: req.currency,
      }),
    );

    await this.simulateLatency();

    const amountNum = parseFloat(req.amount);
    if (amountNum > THREE_DS_THRESHOLD_AMOUNT) {
      // 3DS flow: return requires_3ds with a token for callback correlation
      const posTransactionToken = `mock_3ds_${req.paymentId}_${Date.now()}`;
      this.issuedTokens.add(posTransactionToken);
      this.logger.debug(
        JSON.stringify({
          event: 'mock_pos_3ds_required',
          payment_id: req.paymentId,
          amount: req.amount,
          token: posTransactionToken,
        }),
      );
      return {
        status: 'requires_3ds' as const,
        posReference: null,
        message: 'Mock 3DS verification required',
        posTransactionToken,
        threeDsHtmlContent: `<form id="mock3ds"><input name="token" value="${posTransactionToken}"/></form>`,
      };
    }

    // Non-3DS: direct provision for low amounts
    const posReference = `mock_prov_${req.paymentId}_${Date.now()}`;
    this.completedTokens.add(req.paymentId);
    this.completedTokens.add(posReference);

    return {
      status: 'completed' as const,
      posReference,
      message: 'Mock provision successful (non-3DS)',
    };
  }

  async completeProvision(req: CompleteProvisionRequest): Promise<ProvisionResponse> {
    this.logger.debug(
      JSON.stringify({
        event: 'mock_pos_complete_provision',
        payment_id: req.paymentId,
        pos_transaction_token: req.posTransactionToken,
      }),
    );

    await this.simulateLatency();

    const posReference = `mock_prov_${req.paymentId}_${Date.now()}`;
    this.completedTokens.add(req.paymentId);
    this.completedTokens.add(posReference);
    if (req.posTransactionToken) {
      this.completedTokens.add(req.posTransactionToken);
    }

    return {
      success: true,
      posReference,
      message: 'Mock 3DS completion successful',
    };
  }

  verifyCallback(_headers: Record<string, string>, body: Record<string, unknown>): boolean {
    // Validate that the callback references a token we actually issued
    const token =
      (body.pos_transaction_token as string | undefined) ??
      (body.token as string | undefined);
    const merchantOid = body.merchant_oid as string | undefined;

    const valid =
      (!!token && this.issuedTokens.has(token)) ||
      (!!merchantOid && this.completedTokens.has(merchantOid));

    this.logger.debug(
      JSON.stringify({
        event: 'mock_pos_verify_callback',
        valid,
        token_present: !!token,
        merchant_oid_present: !!merchantOid,
      }),
    );
    return valid;
  }

  async queryTransactionStatus(posReference: string): Promise<TransactionStatusResponse> {
    this.logger.debug(
      JSON.stringify({
        event: 'mock_pos_query_status',
        pos_reference: posReference,
        known: this.completedTokens.has(posReference),
      }),
    );

    await this.simulateLatency();

    if (this.completedTokens.has(posReference)) {
      return { found: true, status: 'completed', posReference };
    }
    return { found: false, status: 'unknown', posReference };
  }

  /** @deprecated Use initiateProvision() + completeProvision() */
  async provision(req: ProvisionRequest): Promise<ProvisionResponse> {
    this.logger.debug(
      JSON.stringify({
        event: 'mock_pos_provision',
        payment_id: req.paymentId,
        amount: req.amount,
        currency: req.currency,
      }),
    );

    await this.simulateLatency();

    return {
      success: true,
      posReference: `mock_prov_${req.paymentId}_${Date.now()}`,
      message: 'Mock provision successful',
    };
  }

  async capture(req: CaptureProvisionRequest): Promise<CaptureProvisionResponse> {
    this.logger.debug(
      JSON.stringify({
        event: 'mock_pos_capture',
        payment_id: req.paymentId,
        pos_reference: req.posReference,
        amount: req.amount,
      }),
    );

    await this.simulateLatency();

    return {
      success: true,
      posReference: `mock_cap_${req.paymentId}_${Date.now()}`,
      message: 'Mock capture successful',
    };
  }

  async cancelProvision(req: CancelProvisionRequest): Promise<CancelProvisionResponse> {
    this.logger.debug(
      JSON.stringify({
        event: 'mock_pos_cancel',
        payment_id: req.paymentId,
        pos_reference: req.posReference,
      }),
    );

    await this.simulateLatency();

    return {
      success: true,
      message: 'Mock cancel successful',
    };
  }

  async refund(req: PosRefundRequest): Promise<PosRefundResponse> {
    this.logger.debug(
      JSON.stringify({
        event: 'mock_pos_refund',
        payment_id: req.paymentId,
        pos_reference: req.posReference,
        amount: req.amount,
      }),
    );

    await this.simulateLatency();

    return {
      success: true,
      posRefundReference: `mock_ref_${req.paymentId}_${Date.now()}`,
      message: 'Mock refund successful',
    };
  }

  private async simulateLatency(): Promise<void> {
    const ms = LATENCY_MIN_MS + Math.random() * (LATENCY_MAX_MS - LATENCY_MIN_MS);
    await new Promise((resolve) => setTimeout(resolve, ms));
  }
}
