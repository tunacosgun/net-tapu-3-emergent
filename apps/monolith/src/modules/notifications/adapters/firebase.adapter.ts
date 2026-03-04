import { Injectable, Logger, OnModuleInit } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import {
  NotificationProvider,
  PushPayload,
  NotificationResult,
} from '../notification-provider.interface';

/**
 * Firebase Cloud Messaging (FCM) adapter for push notifications.
 *
 * Configuration (env vars):
 *   FIREBASE_PROJECT_ID
 *   FIREBASE_CLIENT_EMAIL
 *   FIREBASE_PRIVATE_KEY (base64-encoded or raw PEM)
 *
 * When Firebase is not configured, calls fall through to the console adapter.
 */
@Injectable()
export class FirebaseAdapter implements NotificationProvider, OnModuleInit {
  readonly channel = 'push' as const;
  private readonly logger = new Logger(FirebaseAdapter.name);

  private readonly projectId: string | undefined;
  private readonly clientEmail: string | undefined;
  private readonly privateKey: string | undefined;

  private accessToken: string | null = null;
  private tokenExpiresAt = 0;

  constructor(private readonly config: ConfigService) {
    this.projectId = this.config.get<string>('FIREBASE_PROJECT_ID');
    this.clientEmail = this.config.get<string>('FIREBASE_CLIENT_EMAIL');

    const rawKey = this.config.get<string>('FIREBASE_PRIVATE_KEY');
    if (rawKey) {
      // Support both base64-encoded and raw PEM private keys
      this.privateKey = rawKey.includes('BEGIN')
        ? rawKey
        : Buffer.from(rawKey, 'base64').toString('utf-8');
    }
  }

  async onModuleInit() {
    if (this.isConfigured()) {
      this.logger.log('Firebase push adapter initialized');
    } else {
      this.logger.warn(
        'Firebase not configured — push notifications will use console fallback',
      );
    }
  }

  isConfigured(): boolean {
    return !!(this.projectId && this.clientEmail && this.privateKey);
  }

  async send(payload: PushPayload): Promise<NotificationResult> {
    if (!this.isConfigured()) {
      return { success: false, error: 'Firebase not configured' };
    }

    try {
      const token = await this.getAccessToken();
      const url = `https://fcm.googleapis.com/v1/projects/${this.projectId}/messages:send`;

      const message = {
        message: {
          token: payload.deviceToken,
          notification: {
            title: payload.title,
            body: payload.body,
          },
          data: payload.data
            ? Object.fromEntries(
                Object.entries(payload.data).map(([k, v]) => [k, String(v)]),
              )
            : undefined,
          android: {
            priority: 'high' as const,
            notification: {
              sound: 'default',
              click_action: 'FLUTTER_NOTIFICATION_CLICK',
            },
          },
          apns: {
            payload: {
              aps: {
                sound: 'default',
                badge: 1,
              },
            },
          },
          webpush: {
            headers: {
              Urgency: 'high',
            },
            notification: {
              icon: '/icons/icon-192.png',
              badge: '/icons/badge-72.png',
            },
          },
        },
      };

      const response = await fetch(url, {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${token}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(message),
      });

      if (response.ok) {
        const data = (await response.json()) as { name?: string };
        this.logger.log(`Push sent to token ${payload.deviceToken.slice(0, 12)}...`);
        return {
          success: true,
          providerMessageId: data.name,
          rawResponse: data as Record<string, unknown>,
        };
      }

      const errorBody = await response.text();
      this.logger.error(`FCM error: ${response.status} - ${errorBody}`);

      // Handle invalid token — should remove device
      if (response.status === 404 || response.status === 400) {
        return {
          success: false,
          error: `FCM ${response.status}: Invalid token`,
          rawResponse: { status: response.status, shouldRemoveToken: true },
        };
      }

      return {
        success: false,
        error: `FCM ${response.status}: ${errorBody}`,
        rawResponse: { status: response.status },
      };
    } catch (err) {
      const message = err instanceof Error ? err.message : String(err);
      this.logger.error(`Firebase push failed: ${message}`);
      return { success: false, error: message };
    }
  }

  /**
   * Send push notification to multiple device tokens.
   */
  async sendToMultiple(
    tokens: string[],
    title: string,
    body: string,
    data?: Record<string, unknown>,
  ): Promise<{ successCount: number; failureCount: number; invalidTokens: string[] }> {
    let successCount = 0;
    let failureCount = 0;
    const invalidTokens: string[] = [];

    for (const token of tokens) {
      const result = await this.send({ deviceToken: token, title, body, data });
      if (result.success) {
        successCount++;
      } else {
        failureCount++;
        if (
          result.rawResponse &&
          (result.rawResponse as Record<string, unknown>).shouldRemoveToken
        ) {
          invalidTokens.push(token);
        }
      }
    }

    return { successCount, failureCount, invalidTokens };
  }

  // ── OAuth2 token management ──

  private async getAccessToken(): Promise<string> {
    if (this.accessToken && Date.now() < this.tokenExpiresAt - 60_000) {
      return this.accessToken;
    }

    const jwt = await this.createSignedJwt();
    const tokenResponse = await fetch('https://oauth2.googleapis.com/token', {
      method: 'POST',
      headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
      body: new URLSearchParams({
        grant_type: 'urn:ietf:params:oauth:grant-type:jwt-bearer',
        assertion: jwt,
      }),
    });

    if (!tokenResponse.ok) {
      const errorText = await tokenResponse.text();
      throw new Error(`Failed to get Firebase access token: ${errorText}`);
    }

    const tokenData = (await tokenResponse.json()) as { access_token: string; expires_in?: number };
    this.accessToken = tokenData.access_token;
    this.tokenExpiresAt = Date.now() + (tokenData.expires_in ?? 3600) * 1000;

    return this.accessToken!;
  }

  private async createSignedJwt(): Promise<string> {
    const crypto = await import('crypto');

    const header = {
      alg: 'RS256',
      typ: 'JWT',
    };

    const now = Math.floor(Date.now() / 1000);
    const claims = {
      iss: this.clientEmail,
      sub: this.clientEmail,
      aud: 'https://oauth2.googleapis.com/token',
      iat: now,
      exp: now + 3600,
      scope: 'https://www.googleapis.com/auth/firebase.messaging',
    };

    const segments = [
      this.base64url(JSON.stringify(header)),
      this.base64url(JSON.stringify(claims)),
    ];

    const signingInput = segments.join('.');
    const sign = crypto.createSign('RSA-SHA256');
    sign.update(signingInput);
    const signature = sign.sign(this.privateKey!, 'base64url');

    return `${signingInput}.${signature}`;
  }

  private base64url(str: string): string {
    return Buffer.from(str)
      .toString('base64')
      .replace(/\+/g, '-')
      .replace(/\//g, '_')
      .replace(/=+$/, '');
  }
}
