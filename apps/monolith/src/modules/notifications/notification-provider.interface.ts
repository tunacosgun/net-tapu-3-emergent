export interface NotificationResult {
  success: boolean;
  providerMessageId?: string;
  error?: string;
  rawResponse?: Record<string, unknown>;
}

export interface EmailPayload {
  to: string;
  subject: string;
  body: string;
  html?: string;
  from?: string;
}

export interface SmsPayload {
  to: string;
  body: string;
  from?: string;
}

export interface PushPayload {
  deviceToken: string;
  title: string;
  body: string;
  data?: Record<string, unknown>;
}

export interface NotificationProvider {
  readonly channel: 'email' | 'sms' | 'push' | 'whatsapp';

  send(payload: EmailPayload | SmsPayload | PushPayload): Promise<NotificationResult>;

  isConfigured(): boolean;
}

export const NOTIFICATION_PROVIDERS = 'NOTIFICATION_PROVIDERS';
