import { Injectable, Logger } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { NotificationQueue } from '../crm/entities/notification-queue.entity';
import { NotificationLog } from '../crm/entities/notification-log.entity';
import { User } from '../auth/entities/user.entity';
import {
  NotificationProvider,
  EmailPayload,
  SmsPayload,
  NotificationResult,
} from './notification-provider.interface';
import { SendGridAdapter } from './adapters/sendgrid.adapter';
import { NetgsmAdapter } from './adapters/netgsm.adapter';
import { ConsoleNotificationAdapter } from './adapters/console.adapter';

/** Exponential backoff: attempt 1 → 30s, attempt 2 → 2min, attempt 3 → 8min */
const BACKOFF_BASE_MS = 30_000;
const BACKOFF_MULTIPLIER = 4;

@Injectable()
export class NotificationService {
  private readonly logger = new Logger(NotificationService.name);
  private readonly providers: Map<string, NotificationProvider>;

  constructor(
    @InjectRepository(NotificationQueue)
    private readonly queueRepo: Repository<NotificationQueue>,
    @InjectRepository(NotificationLog)
    private readonly logRepo: Repository<NotificationLog>,
    @InjectRepository(User)
    private readonly userRepo: Repository<User>,
    private readonly sendGridAdapter: SendGridAdapter,
    private readonly netgsmAdapter: NetgsmAdapter,
    private readonly consoleAdapter: ConsoleNotificationAdapter,
  ) {
    this.providers = new Map();

    if (this.sendGridAdapter.isConfigured()) {
      this.providers.set('email', this.sendGridAdapter);
      this.logger.log('Email provider: SendGrid');
    } else {
      this.providers.set('email', this.consoleAdapter);
      this.logger.warn('Email provider: Console (SendGrid not configured)');
    }

    if (this.netgsmAdapter.isConfigured()) {
      this.providers.set('sms', this.netgsmAdapter);
      this.logger.log('SMS provider: Netgsm');
    } else {
      this.providers.set('sms', this.consoleAdapter);
      this.logger.warn('SMS provider: Console (Netgsm not configured)');
    }

    this.providers.set('push', this.consoleAdapter);
    this.providers.set('whatsapp', this.consoleAdapter);
  }

  async enqueue(params: {
    userId: string;
    channel: 'email' | 'sms' | 'push' | 'whatsapp';
    subject?: string;
    body: string;
    metadata?: Record<string, unknown>;
    scheduledFor?: Date;
  }): Promise<NotificationQueue> {
    const notification = this.queueRepo.create({
      userId: params.userId,
      channel: params.channel,
      subject: params.subject,
      body: params.body,
      metadata: params.metadata ?? null,
      scheduledFor: params.scheduledFor ?? new Date(),
      status: 'queued',
    });

    return this.queueRepo.save(notification);
  }

  async processNotification(notification: NotificationQueue): Promise<void> {
    const provider = this.providers.get(notification.channel);
    if (!provider) {
      this.logger.error(`No provider for channel: ${notification.channel}`);
      await this.markDeadLetter(notification, 'No provider configured for channel');
      return;
    }

    const currentAttempt = notification.attempts + 1;

    // Mark as sending
    await this.queueRepo.update(notification.id, {
      status: 'sending',
      attempts: currentAttempt,
      lastAttemptAt: new Date(),
    });

    const user = await this.userRepo.findOne({
      where: { id: notification.userId },
    });

    if (!user) {
      this.logger.warn(`User ${notification.userId} not found for notification ${notification.id}`);
      await this.markDeadLetter(notification, 'User not found — non-retryable');
      return;
    }

    let result: NotificationResult;

    try {
      if (notification.channel === 'email') {
        const payload: EmailPayload = {
          to: user.email,
          subject: notification.subject || 'NetTapu Bildirimi',
          body: notification.body,
        };

        try {
          const parsed = JSON.parse(notification.body);
          if (parsed.template) {
            payload.body = this.renderTemplate(parsed);
            payload.html = payload.body;
          }
        } catch {
          // body is plain text
        }

        result = await provider.send(payload);
      } else if (notification.channel === 'sms') {
        if (!user.phone) {
          await this.markDeadLetter(notification, 'User has no phone number — non-retryable');
          return;
        }

        const payload: SmsPayload = {
          to: user.phone,
          body: notification.body,
        };
        result = await provider.send(payload);
      } else {
        result = await provider.send({
          to: user.email,
          subject: notification.subject || '',
          body: notification.body,
        } as EmailPayload);
      }
    } catch (err) {
      const errMsg = err instanceof Error ? err.message : String(err);
      this.logger.error(`Provider error: ${errMsg}`);
      result = { success: false, error: errMsg };
    }

    if (result.success) {
      await this.queueRepo.update(notification.id, { status: 'sent' });
    } else if (currentAttempt >= notification.maxAttempts) {
      await this.markDeadLetter(
        notification,
        result.error || `Max attempts (${notification.maxAttempts}) reached`,
      );
    } else {
      // Exponential backoff: schedule retry in the future
      const delayMs = BACKOFF_BASE_MS * Math.pow(BACKOFF_MULTIPLIER, currentAttempt - 1);
      const nextRetry = new Date(Date.now() + delayMs);
      await this.queueRepo.update(notification.id, {
        status: 'queued',
        scheduledFor: nextRetry,
      });
      this.logger.warn(
        `Notification ${notification.id} retry #${currentAttempt} scheduled for ${nextRetry.toISOString()} (delay: ${delayMs}ms)`,
      );
    }

    // Always log the attempt
    await this.logRepo.save(
      this.logRepo.create({
        queueId: notification.id,
        userId: notification.userId,
        channel: notification.channel,
        status: result.success ? 'sent' : 'failed',
        subject: notification.subject,
        body: notification.body,
        providerResponse: result.rawResponse ?? (result.error ? { error: result.error } : null),
        deliveredAt: result.success ? new Date() : null,
      }),
    );
  }

  async handleEvent(event: string, userId?: string, metadata?: Record<string, unknown>): Promise<void> {
    const templateMap: Record<string, { channel: 'email' | 'sms'; subject: string }> = {
      'user.registered': { channel: 'email', subject: 'NetTapu\'ya Hoş Geldiniz' },
      'user.password_reset_requested': { channel: 'email', subject: 'Şifre Sıfırlama' },
      'auction.deposit_paid': { channel: 'email', subject: 'Teminat Ödemeniz Onaylandı' },
      'auction.bid_placed': { channel: 'email', subject: 'Teklifiniz Alındı' },
      'auction.won': { channel: 'email', subject: 'Tebrikler! İhaleyi Kazandınız' },
      'auction.lost': { channel: 'email', subject: 'İhale Sonucu' },
      'auction.starting_soon': { channel: 'email', subject: 'İhale Yakında Başlıyor' },
      'payment.success': { channel: 'email', subject: 'Ödemeniz Onaylandı' },
      'payment.failed': { channel: 'email', subject: 'Ödeme Başarısız' },
      'offer.received': { channel: 'email', subject: 'Yeni Teklif Aldınız' },
      'offer.accepted': { channel: 'email', subject: 'Teklifiniz Kabul Edildi' },
      'offer.rejected': { channel: 'email', subject: 'Teklifiniz Reddedildi' },
      'offer.countered': { channel: 'email', subject: 'Karşı Teklif Aldınız' },
      'appointment.scheduled': { channel: 'email', subject: 'Randevunuz Oluşturuldu' },
      'appointment.reminder': { channel: 'email', subject: 'Randevu Hatırlatması' },
      'appointment.cancelled': { channel: 'email', subject: 'Randevunuz İptal Edildi' },
      'contact.received': { channel: 'email', subject: 'İletişim Talebiniz Alındı' },
    };

    const template = templateMap[event];
    if (!template) {
      this.logger.warn(`Unknown notification event: ${event}`);
      return;
    }

    if (!userId) {
      this.logger.warn(`Event ${event} has no userId, skipping`);
      return;
    }

    await this.enqueue({
      userId,
      channel: template.channel,
      subject: template.subject,
      body: JSON.stringify({ template: event, ...metadata }),
      metadata: { event, ...metadata },
    });
  }

  /**
   * Dead-letter: mark as failed permanently with reason logged.
   */
  private async markDeadLetter(notification: NotificationQueue, reason: string): Promise<void> {
    await this.queueRepo.update(notification.id, {
      status: 'failed',
      metadata: {
        ...(notification.metadata ?? {}),
        deadLetterReason: reason,
        deadLetteredAt: new Date().toISOString(),
      },
    });
    this.logger.error(
      `Notification ${notification.id} dead-lettered: ${reason} (attempts: ${notification.attempts})`,
    );
  }

  private renderTemplate(data: Record<string, unknown>): string {
    const template = data.template as string;
    const firstName = (data.firstName as string) || 'Değerli Kullanıcı';

    switch (template) {
      case 'password_reset':
        return `<p>Merhaba ${firstName},</p>
<p>Şifre sıfırlama talebiniz alındı. Aşağıdaki bağlantıyı kullanarak şifrenizi sıfırlayabilirsiniz:</p>
<p><strong>Sıfırlama Kodu:</strong> ${data.resetToken}</p>
<p>Bu bağlantı ${data.expiresInMinutes} dakika geçerlidir.</p>
<p>Bu talebi siz yapmadıysanız, bu e-postayı görmezden gelebilirsiniz.</p>
<p>— NetTapu Ekibi</p>`;

      case 'email_verification':
        return `<p>Merhaba ${firstName},</p>
<p>E-posta adresinizi doğrulamak için aşağıdaki kodu kullanın:</p>
<p><strong>Doğrulama Kodu:</strong> ${data.verificationToken}</p>
<p>Bu kod ${data.expiresInHours} saat geçerlidir.</p>
<p>— NetTapu Ekibi</p>`;

      case 'user.registered':
        return `<p>Merhaba ${firstName},</p>
<p>NetTapu platformuna hoş geldiniz! Hesabınız başarıyla oluşturuldu.</p>
<p>— NetTapu Ekibi</p>`;

      default:
        return `<p>Merhaba ${firstName},</p><p>${JSON.stringify(data)}</p>`;
    }
  }
}
