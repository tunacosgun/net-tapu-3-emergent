import {
  Controller,
  Post,
  Body,
  Headers,
  Param,
  Ip,
  HttpCode,
  HttpStatus,
  Logger,
  BadRequestException,
} from '@nestjs/common';
import { Throttle } from '@nestjs/throttler';
import { PosCallbackService } from '../services/pos-callback.service';

/**
 * Handles callbacks/webhooks from POS providers (PayTR, iyzico).
 *
 * These endpoints are:
 *   - Unauthenticated (no JWT) — providers can't supply auth tokens
 *   - Signature-verified internally by the PosCallbackService
 *   - Rate-limited to prevent abuse
 *   - Must return plain "OK" for PayTR (their requirement)
 */
@Controller('payments/pos-callback')
export class PosCallbackController {
  private readonly logger = new Logger(PosCallbackController.name);

  constructor(private readonly callbackService: PosCallbackService) {}

  @Post('paytr')
  @HttpCode(HttpStatus.OK)
  @Throttle({ short: { ttl: 60000, limit: 30 } })
  async paytrCallback(
    @Body() body: Record<string, unknown>,
    @Headers() headers: Record<string, string>,
    @Ip() ip: string,
  ): Promise<string> {
    try {
      await this.callbackService.processCallback('paytr', headers, body, ip);
    } catch (err) {
      this.logger.error(
        JSON.stringify({
          event: 'paytr_callback_error',
          error: (err as Error).message,
          ip,
        }),
      );
      throw err;
    }
    return 'OK';
  }

  @Post('iyzico')
  @HttpCode(HttpStatus.OK)
  @Throttle({ short: { ttl: 60000, limit: 30 } })
  async iyzicoCallback(
    @Body() body: Record<string, unknown>,
    @Headers() headers: Record<string, string>,
    @Ip() ip: string,
  ): Promise<string> {
    try {
      await this.callbackService.processCallback('iyzico', headers, body, ip);
    } catch (err) {
      this.logger.error(
        JSON.stringify({
          event: 'iyzico_callback_error',
          error: (err as Error).message,
          ip,
        }),
      );
      throw err;
    }
    return 'OK';
  }
}
