import { Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
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
import { MockPosGateway } from './mock-pos-gateway.service';

const logger = new Logger('PosGatewayFactory');

const DEFAULT_POS_TIMEOUT_MS = 7000;

class PosTimeoutError extends Error {
  constructor(method: string, ms: number) {
    super(`POS call "${method}" timed out after ${ms}ms`);
    this.name = 'PosTimeoutError';
  }
}

function withTimeout<T>(promise: Promise<T>, ms: number, method: string): Promise<T> {
  return new Promise<T>((resolve, reject) => {
    const timer = setTimeout(
      () => reject(new PosTimeoutError(method, ms)),
      ms,
    );
    promise.then(
      (val) => { clearTimeout(timer); resolve(val); },
      (err) => { clearTimeout(timer); reject(err); },
    );
  });
}

/**
 * Wraps any IPosGateway with a per-call timeout.
 * Rejects with PosTimeoutError if the underlying call exceeds the limit.
 * Does not modify the gateway instance — pure decorator.
 */
class TimeoutPosGateway implements IPosGateway {
  constructor(
    private readonly inner: IPosGateway,
    private readonly timeoutMs: number,
  ) {}

  provision(req: ProvisionRequest): Promise<ProvisionResponse> {
    return withTimeout(this.inner.provision(req), this.timeoutMs, 'provision');
  }

  capture(req: CaptureProvisionRequest): Promise<CaptureProvisionResponse> {
    return withTimeout(this.inner.capture(req), this.timeoutMs, 'capture');
  }

  cancelProvision(req: CancelProvisionRequest): Promise<CancelProvisionResponse> {
    return withTimeout(this.inner.cancelProvision(req), this.timeoutMs, 'cancelProvision');
  }

  refund(req: PosRefundRequest): Promise<PosRefundResponse> {
    return withTimeout(this.inner.refund(req), this.timeoutMs, 'refund');
  }
}

/**
 * Factory function for POS_GATEWAY DI token.
 * Reads POS_PROVIDER env var and returns the matching gateway instance
 * wrapped with a timeout decorator.
 *
 * Production: POS_PROVIDER must be explicitly set (validated in ConfigModule).
 * Development: defaults to 'mock' if unset.
 *
 * To add a new provider:
 *   1. Create a class implementing IPosGateway
 *   2. Add a case to the switch below
 *   3. Inject any config the provider needs from ConfigService
 */
export function posGatewayFactory(config: ConfigService): IPosGateway {
  const provider = config.get<string>('POS_PROVIDER', 'mock');
  const timeoutMs = config.get<number>('POS_TIMEOUT_MS', DEFAULT_POS_TIMEOUT_MS);

  let gateway: IPosGateway;

  switch (provider) {
    case 'mock':
      logger.log('POS provider initialized: mock');
      gateway = new MockPosGateway();
      break;

    // case 'paytr':
    //   gateway = new PaytrGateway(config);
    //   break;
    // case 'iyzico':
    //   gateway = new IyzicoGateway(config);
    //   break;

    default:
      throw new Error(
        `Unknown POS_PROVIDER: "${provider}". Supported: mock`,
      );
  }

  logger.log(`POS timeout: ${timeoutMs}ms`);
  return new TimeoutPosGateway(gateway, timeoutMs);
}
