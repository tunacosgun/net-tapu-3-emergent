import { Injectable, Logger } from '@nestjs/common';
import {
  IPosGateway,
  ProvisionRequest,
  ProvisionResponse,
  CaptureProvisionRequest,
  CaptureProvisionResponse,
  CancelProvisionRequest,
  CancelProvisionResponse,
  PosRefundRequest,
  PosRefundResponse,
} from '@nettapu/shared';

const LATENCY_MIN_MS = 50;
const LATENCY_MAX_MS = 200;

@Injectable()
export class MockPosGateway implements IPosGateway {
  private readonly logger = new Logger(MockPosGateway.name);

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
