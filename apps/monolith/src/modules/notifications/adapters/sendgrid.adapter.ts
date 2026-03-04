import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import {
  NotificationProvider,
  EmailPayload,
  NotificationResult,
} from '../notification-provider.interface';

@Injectable()
export class SendGridAdapter implements NotificationProvider {
  readonly channel = 'email' as const;
  private readonly logger = new Logger(SendGridAdapter.name);
  private readonly apiKey: string | undefined;
  private readonly fromEmail: string;
  private readonly baseUrl = 'https://api.sendgrid.com/v3/mail/send';

  constructor(private readonly config: ConfigService) {
    this.apiKey = this.config.get<string>('SENDGRID_API_KEY');
    this.fromEmail = this.config.get<string>('SENDGRID_FROM_EMAIL', 'noreply@nettapu.com');
  }

  isConfigured(): boolean {
    return !!this.apiKey;
  }

  async send(payload: EmailPayload): Promise<NotificationResult> {
    if (!this.apiKey) {
      this.logger.warn('SendGrid API key not configured, skipping email');
      return { success: false, error: 'SendGrid not configured' };
    }

    try {
      const response = await fetch(this.baseUrl, {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${this.apiKey}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          personalizations: [
            {
              to: [{ email: payload.to }],
              subject: payload.subject,
            },
          ],
          from: { email: payload.from || this.fromEmail },
          content: [
            {
              type: payload.html ? 'text/html' : 'text/plain',
              value: payload.html || payload.body,
            },
          ],
        }),
      });

      if (response.ok || response.status === 202) {
        const messageId = response.headers.get('x-message-id') || undefined;
        this.logger.log(`Email sent to ${payload.to}, messageId: ${messageId}`);
        return {
          success: true,
          providerMessageId: messageId,
          rawResponse: { status: response.status },
        };
      }

      const errorBody = await response.text();
      this.logger.error(`SendGrid error: ${response.status} - ${errorBody}`);
      return {
        success: false,
        error: `SendGrid ${response.status}: ${errorBody}`,
        rawResponse: { status: response.status, body: errorBody },
      };
    } catch (err) {
      const message = err instanceof Error ? err.message : String(err);
      this.logger.error(`SendGrid request failed: ${message}`);
      return { success: false, error: message };
    }
  }
}
