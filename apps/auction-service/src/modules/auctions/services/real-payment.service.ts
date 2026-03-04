import { Injectable, Logger, Inject, Optional } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import {
  IPosGateway,
  PaytrGateway,
  PaytrConfig,
  IyzicoGateway,
  IyzicoConfig,
  PosLogger,
} from '@nettapu/shared';
import { MetricsService } from '../../../metrics/metrics.service';
import {
  IPaymentService,
  CaptureRequest,
  CaptureResponse,
  RefundRequest,
  RefundResponse,
  CircuitBreaker,
  CircuitState,
  PosTimeoutError,
} from './payment.service';

const POS_TIMEOUT_MS = 7_000;

const CIRCUIT_STATE_VALUES: Record<CircuitState, number> = {
  CLOSED: 0,
  HALF_OPEN: 1,
  OPEN: 2,
};

function withTimeout<T>(promise: Promise<T>, ms: number): Promise<T> {
  return new Promise<T>((resolve, reject) => {
    const timer = setTimeout(() => reject(new PosTimeoutError(ms)), ms);
    promise.then(
      (val) => { clearTimeout(timer); resolve(val); },
      (err) => { clearTimeout(timer); reject(err); },
    );
  });
}

/**
 * Real POS payment service for auction settlement.
 *
 * Uses shared IPosGateway adapters (PayTR/iyzico) directly
 * for capture and refund operations. Settlement operations are
 * always server-to-server (no 3DS needed).
 *
 * Preserves the CircuitBreaker pattern from MockPaymentService.
 */
@Injectable()
export class RealPaymentService implements IPaymentService {
  private readonly logger = new Logger(RealPaymentService.name);
  private readonly circuitBreaker: CircuitBreaker;
  private readonly posGateway: IPosGateway;

  constructor(
    private readonly config: ConfigService,
    @Optional() @Inject(MetricsService) private readonly metrics?: MetricsService,
  ) {
    this.posGateway = this.createGateway();

    this.circuitBreaker = new CircuitBreaker({
      onStateChange: (state) => {
        this.metrics?.settlementPosCircuitState.set(CIRCUIT_STATE_VALUES[state]);
      },
      onTrip: () => {
        this.metrics?.settlementPosCircuitTripsTotal.inc();
      },
    });

    this.logger.log(
      JSON.stringify({
        event: 'real_payment_service_initialized',
        provider: this.config.get<string>('POS_PROVIDER'),
      }),
    );
  }

  getCircuitState(): CircuitState {
    return this.circuitBreaker.getState();
  }

  async captureDeposit(req: CaptureRequest): Promise<CaptureResponse> {
    return this.circuitBreaker.execute(async () => {
      try {
        return await withTimeout(this.doCapture(req), POS_TIMEOUT_MS);
      } catch (err) {
        if (err instanceof PosTimeoutError) {
          this.metrics?.settlementPosTimeoutsTotal.inc();
          this.logger.warn(
            JSON.stringify({
              event: 'pos_timeout',
              operation: 'capture',
              deposit_id: req.depositId,
              timeout_ms: POS_TIMEOUT_MS,
            }),
          );
        }
        throw err;
      }
    });
  }

  async refundDeposit(req: RefundRequest): Promise<RefundResponse> {
    return this.circuitBreaker.execute(async () => {
      try {
        return await withTimeout(this.doRefund(req), POS_TIMEOUT_MS);
      } catch (err) {
        if (err instanceof PosTimeoutError) {
          this.metrics?.settlementPosTimeoutsTotal.inc();
          this.logger.warn(
            JSON.stringify({
              event: 'pos_timeout',
              operation: 'refund',
              deposit_id: req.depositId,
              timeout_ms: POS_TIMEOUT_MS,
            }),
          );
        }
        throw err;
      }
    });
  }

  private async doCapture(req: CaptureRequest): Promise<CaptureResponse> {
    this.logger.debug(
      JSON.stringify({
        event: 'pos_capture_request',
        deposit_id: req.depositId,
        amount: req.amount,
        currency: req.currency,
        idempotency_key: req.idempotencyKey,
      }),
    );

    const result = await this.posGateway.capture({
      paymentId: req.depositId,
      posReference: req.posTransactionId || '',
      amount: req.amount,
      currency: req.currency,
      idempotencyKey: req.idempotencyKey,
      metadata: req.metadata,
    });

    return {
      success: result.success,
      posReference: result.posReference,
      message: result.message,
    };
  }

  private async doRefund(req: RefundRequest): Promise<RefundResponse> {
    this.logger.debug(
      JSON.stringify({
        event: 'pos_refund_request',
        deposit_id: req.depositId,
        amount: req.amount,
        currency: req.currency,
        idempotency_key: req.idempotencyKey,
      }),
    );

    const result = await this.posGateway.refund({
      paymentId: req.depositId,
      posReference: req.posTransactionId || '',
      amount: req.amount,
      currency: req.currency,
      idempotencyKey: req.idempotencyKey,
      metadata: req.metadata,
    });

    return {
      success: result.success,
      posRefundId: result.posRefundReference,
      message: result.message,
    };
  }

  private createGateway(): IPosGateway {
    const provider = this.config.get<string>('POS_PROVIDER', 'mock');
    const nestLogger = this.logger;
    const posLogger: PosLogger = {
      log: (msg) => nestLogger.log(msg),
      warn: (msg) => nestLogger.warn(msg),
      error: (msg) => nestLogger.error(msg),
      debug: (msg) => nestLogger.debug(msg),
    };

    switch (provider) {
      case 'paytr': {
        const paytrConfig: PaytrConfig = {
          merchantId: this.config.getOrThrow<string>('PAYTR_MERCHANT_ID'),
          merchantKey: this.config.getOrThrow<string>('PAYTR_MERCHANT_KEY'),
          merchantSalt: this.config.getOrThrow<string>('PAYTR_MERCHANT_SALT'),
          callbackUrl: this.config.getOrThrow<string>('PAYTR_CALLBACK_URL'),
          okUrl: this.config.getOrThrow<string>('PAYTR_OK_URL'),
          failUrl: this.config.getOrThrow<string>('PAYTR_FAIL_URL'),
          testMode: this.config.get<string>('PAYTR_TEST_MODE', '1') === '1',
        };
        const httpPost = async (url: string, data: URLSearchParams) => {
          const controller = new AbortController();
          const timer = setTimeout(() => controller.abort(), POS_TIMEOUT_MS);
          try {
            const res = await fetch(url, {
              method: 'POST',
              headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
              body: data.toString(),
              signal: controller.signal,
            });
            return { data: await res.json() };
          } finally {
            clearTimeout(timer);
          }
        };
        return new PaytrGateway(paytrConfig, httpPost, posLogger);
      }

      case 'iyzico': {
        const iyzicoConfig: IyzicoConfig = {
          apiKey: this.config.getOrThrow<string>('IYZICO_API_KEY'),
          secretKey: this.config.getOrThrow<string>('IYZICO_SECRET_KEY'),
          baseUrl: this.config.get<string>('IYZICO_BASE_URL', 'https://sandbox-api.iyzipay.com'),
          callbackUrl: this.config.getOrThrow<string>('IYZICO_CALLBACK_URL'),
        };
        const httpPostJson = async (url: string, body: unknown, headers: Record<string, string>) => {
          const controller = new AbortController();
          const timer = setTimeout(() => controller.abort(), POS_TIMEOUT_MS);
          try {
            const res = await fetch(url, {
              method: 'POST',
              headers,
              body: JSON.stringify(body),
              signal: controller.signal,
            });
            return { data: await res.json() };
          } finally {
            clearTimeout(timer);
          }
        };
        return new IyzicoGateway(iyzicoConfig, httpPostJson, posLogger);
      }

      default:
        throw new Error(
          `RealPaymentService: unsupported POS_PROVIDER "${provider}". Use MockPaymentService for mock mode.`,
        );
    }
  }
}
