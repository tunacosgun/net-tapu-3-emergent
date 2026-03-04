import { randomUUID } from 'crypto';
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
} from '../pos-gateway.types';
import { IPosGateway } from '../pos-gateway.interface';

export interface PosLogger {
  log(message: string): void;
  warn(message: string): void;
  error(message: string): void;
  debug(message: string): void;
}

/**
 * Abstract base for POS gateway adapters.
 * Provides structured financial logging, request ID generation,
 * and error normalization. Concrete adapters override the abstract methods.
 */
export abstract class BasePosGateway implements IPosGateway {
  protected abstract readonly providerName: string;
  protected readonly logger: PosLogger;

  constructor(logger: PosLogger) {
    this.logger = logger;
  }

  protected generateRequestId(): string {
    return randomUUID();
  }

  protected logRequest(method: string, payload: Record<string, unknown>): string {
    const requestId = this.generateRequestId();
    this.logger.debug(
      JSON.stringify({
        event: `pos_${method}_request`,
        provider: this.providerName,
        request_id: requestId,
        ...payload,
      }),
    );
    return requestId;
  }

  protected logResponse(
    method: string,
    requestId: string,
    success: boolean,
    payload: Record<string, unknown>,
  ): void {
    const level = success ? 'debug' : 'warn';
    this.logger[level](
      JSON.stringify({
        event: `pos_${method}_response`,
        provider: this.providerName,
        request_id: requestId,
        success,
        ...payload,
      }),
    );
  }

  protected logError(method: string, requestId: string, error: unknown): void {
    this.logger.error(
      JSON.stringify({
        event: `pos_${method}_error`,
        provider: this.providerName,
        request_id: requestId,
        error: error instanceof Error ? error.message : String(error),
        stack: error instanceof Error ? error.stack : undefined,
      }),
    );
  }

  /**
   * Normalize provider-specific errors into a standard response.
   * Prevents raw provider errors from leaking to callers.
   */
  protected normalizeError(method: string, error: unknown): { success: false; message: string } {
    const msg = error instanceof Error ? error.message : String(error);
    return { success: false, message: `${this.providerName} ${method} failed: ${msg}` };
  }

  abstract initiateProvision(req: ProvisionRequest): Promise<ProvisionInitiationResponse>;
  abstract completeProvision(req: CompleteProvisionRequest): Promise<ProvisionResponse>;
  abstract verifyCallback(headers: Record<string, string>, body: Record<string, unknown>): boolean;
  abstract capture(req: CaptureProvisionRequest): Promise<CaptureProvisionResponse>;
  abstract cancelProvision(req: CancelProvisionRequest): Promise<CancelProvisionResponse>;
  abstract refund(req: PosRefundRequest): Promise<PosRefundResponse>;
  abstract provision(req: ProvisionRequest): Promise<ProvisionResponse>;

  /**
   * Optional: query provider for current transaction status (reconciliation).
   * Override in providers that support this.
   */
  async queryTransactionStatus(_posReference: string): Promise<TransactionStatusResponse> {
    return { found: false, status: 'unsupported' };
  }
}
