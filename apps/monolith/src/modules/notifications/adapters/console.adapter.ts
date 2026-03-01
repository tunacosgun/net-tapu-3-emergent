import { Injectable, Logger } from '@nestjs/common';
import {
  NotificationProvider,
  EmailPayload,
  SmsPayload,
  PushPayload,
  NotificationResult,
} from '../notification-provider.interface';

/**
 * Console adapter for development/testing.
 * Logs notification content to stdout instead of sending.
 * Used when no real provider is configured.
 */
@Injectable()
export class ConsoleNotificationAdapter implements NotificationProvider {
  readonly channel = 'email' as const;
  private readonly logger = new Logger(ConsoleNotificationAdapter.name);

  isConfigured(): boolean {
    return true;
  }

  async send(
    payload: EmailPayload | SmsPayload | PushPayload,
  ): Promise<NotificationResult> {
    this.logger.log(
      `[CONSOLE] Notification dispatched:\n${JSON.stringify(payload, null, 2)}`,
    );
    return {
      success: true,
      providerMessageId: `console-${Date.now()}`,
    };
  }
}
