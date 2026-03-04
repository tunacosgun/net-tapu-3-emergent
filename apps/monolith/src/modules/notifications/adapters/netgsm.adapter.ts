import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import {
  NotificationProvider,
  SmsPayload,
  NotificationResult,
} from '../notification-provider.interface';

@Injectable()
export class NetgsmAdapter implements NotificationProvider {
  readonly channel = 'sms' as const;
  private readonly logger = new Logger(NetgsmAdapter.name);
  private readonly userCode: string | undefined;
  private readonly password: string | undefined;
  private readonly msgHeader: string;
  private readonly baseUrl = 'https://api.netgsm.com.tr/sms/send/get';

  constructor(private readonly config: ConfigService) {
    this.userCode = this.config.get<string>('NETGSM_USERCODE');
    this.password = this.config.get<string>('NETGSM_PASSWORD');
    this.msgHeader = this.config.get<string>('NETGSM_MSGHEADER', 'NETTAPU');
  }

  isConfigured(): boolean {
    return !!(this.userCode && this.password);
  }

  async send(payload: SmsPayload): Promise<NotificationResult> {
    if (!this.isConfigured()) {
      this.logger.warn('Netgsm credentials not configured, skipping SMS');
      return { success: false, error: 'Netgsm not configured' };
    }

    try {
      const params = new URLSearchParams({
        usercode: this.userCode!,
        password: this.password!,
        gsmno: payload.to.replace(/\D/g, ''),
        message: payload.body,
        msgheader: payload.from || this.msgHeader,
      });

      const response = await fetch(`${this.baseUrl}?${params.toString()}`);
      const responseText = await response.text();

      // Netgsm returns code-based responses: 00 = success, 20 = post error, etc.
      const responseCode = responseText.trim().split(' ')[0];

      if (responseCode === '00' || responseCode === '01' || responseCode === '02') {
        this.logger.log(`SMS sent to ${payload.to}, response: ${responseText}`);
        return {
          success: true,
          providerMessageId: responseText.trim(),
          rawResponse: { code: responseCode, body: responseText },
        };
      }

      this.logger.error(`Netgsm error: ${responseText}`);
      return {
        success: false,
        error: `Netgsm error code: ${responseCode}`,
        rawResponse: { code: responseCode, body: responseText },
      };
    } catch (err) {
      const message = err instanceof Error ? err.message : String(err);
      this.logger.error(`Netgsm request failed: ${message}`);
      return { success: false, error: message };
    }
  }
}
