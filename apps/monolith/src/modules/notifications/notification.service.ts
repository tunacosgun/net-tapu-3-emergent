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
  PushPayload,
  NotificationResult,
} from './notification-provider.interface';
import { SendGridAdapter } from './adapters/sendgrid.adapter';
import { NetgsmAdapter } from './adapters/netgsm.adapter';
import { FirebaseAdapter } from './adapters/firebase.adapter';
import { ConsoleNotificationAdapter } from './adapters/console.adapter';
import { UserDevice } from './entities/user-device.entity';

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
    @InjectRepository(UserDevice)
    private readonly deviceRepo: Repository<UserDevice>,
    private readonly sendGridAdapter: SendGridAdapter,
    private readonly netgsmAdapter: NetgsmAdapter,
    private readonly firebaseAdapter: FirebaseAdapter,
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

    if (this.firebaseAdapter.isConfigured()) {
      this.providers.set('push', this.firebaseAdapter);
      this.logger.log('Push provider: Firebase');
    } else {
      this.providers.set('push', this.consoleAdapter);
      this.logger.warn('Push provider: Console (Firebase not configured)');
    }

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
      } else if (notification.channel === 'push') {
        // Look up user's active device tokens
        const devices = await this.deviceRepo.find({
          where: { userId: notification.userId, isActive: true },
        });

        if (devices.length === 0) {
          await this.markDeadLetter(notification, 'No active devices — non-retryable');
          return;
        }

        // Send to all active devices
        let anySuccess = false;
        const errors: string[] = [];

        for (const device of devices) {
          const pushPayload: PushPayload = {
            deviceToken: device.deviceToken,
            title: notification.subject || 'NetTapu',
            body: notification.body,
            data: notification.metadata ?? undefined,
          };
          const pushResult = await provider.send(pushPayload);

          if (pushResult.success) {
            anySuccess = true;
            // Update last used timestamp
            await this.deviceRepo.update(device.id, { lastUsedAt: new Date() });
          } else {
            errors.push(pushResult.error || 'Unknown error');
            // Deactivate invalid tokens
            if (
              pushResult.rawResponse &&
              (pushResult.rawResponse as Record<string, unknown>).shouldRemoveToken
            ) {
              await this.deviceRepo.update(device.id, { isActive: false });
              this.logger.warn(`Deactivated invalid device token: ${device.id}`);
            }
          }
        }

        result = anySuccess
          ? { success: true }
          : { success: false, error: errors.join('; ') };
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

    const header = `
<!DOCTYPE html><html><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1.0"></head>
<body style="margin:0;padding:0;background:#f9fafb;font-family:Arial,Helvetica,sans-serif;">
<table width="100%" cellpadding="0" cellspacing="0" style="background:#f9fafb;padding:32px 0;">
<tr><td align="center">
<table width="600" cellpadding="0" cellspacing="0" style="background:#ffffff;border-radius:8px;overflow:hidden;">
<tr><td style="background:#16a34a;padding:24px;text-align:center;">
<h1 style="color:#ffffff;margin:0;font-size:24px;">NetTapu</h1>
</td></tr>
<tr><td style="padding:32px;">`;

    const footer = `
<hr style="border:none;border-top:1px solid #e5e7eb;margin:24px 0;">
<p style="color:#9ca3af;font-size:12px;text-align:center;">
Bu e-posta NetTapu platformu tarafından otomatik gönderilmiştir.<br>
© ${new Date().getFullYear()} NetTapu. Tüm hakları saklıdır.
</p>
</td></tr></table></td></tr></table></body></html>`;

    const wrap = (content: string) => `${header}${content}${footer}`;

    switch (template) {
      case 'password_reset':
        return wrap(`
<h2 style="color:#111827;margin:0 0 16px;">Şifre Sıfırlama</h2>
<p>Merhaba ${firstName},</p>
<p>Şifre sıfırlama talebiniz alındı. Aşağıdaki kodu kullanarak şifrenizi sıfırlayabilirsiniz:</p>
<div style="background:#f3f4f6;border-radius:8px;padding:16px;text-align:center;margin:16px 0;">
<span style="font-size:24px;font-weight:bold;letter-spacing:4px;color:#16a34a;">${data.resetToken}</span>
</div>
<p>Bu kod <strong>${data.expiresInMinutes || 15} dakika</strong> geçerlidir.</p>
<p style="color:#6b7280;font-size:13px;">Bu talebi siz yapmadıysanız, bu e-postayı görmezden gelebilirsiniz.</p>`);

      case 'email_verification':
        return wrap(`
<h2 style="color:#111827;margin:0 0 16px;">E-posta Doğrulama</h2>
<p>Merhaba ${firstName},</p>
<p>E-posta adresinizi doğrulamak için aşağıdaki kodu kullanın:</p>
<div style="background:#f3f4f6;border-radius:8px;padding:16px;text-align:center;margin:16px 0;">
<span style="font-size:24px;font-weight:bold;letter-spacing:4px;color:#16a34a;">${data.verificationToken}</span>
</div>
<p>Bu kod <strong>${data.expiresInHours || 24} saat</strong> geçerlidir.</p>`);

      case 'user.registered':
        return wrap(`
<h2 style="color:#111827;margin:0 0 16px;">Hoş Geldiniz!</h2>
<p>Merhaba ${firstName},</p>
<p>NetTapu platformuna hoş geldiniz! Hesabınız başarıyla oluşturuldu.</p>
<p>Artık şunları yapabilirsiniz:</p>
<ul style="color:#374151;">
<li>Arsa ilanlarını inceleme ve filtreleme</li>
<li>Canlı açık artırmalara katılma</li>
<li>Teklif verme ve takip etme</li>
<li>Favorilerinize ilan ekleme</li>
</ul>
<a href="${data.siteUrl || 'https://nettapu.com'}" style="display:inline-block;background:#16a34a;color:#fff;padding:12px 24px;border-radius:6px;text-decoration:none;font-weight:600;margin:8px 0;">Platformu Keşfet</a>`);

      case 'auction.deposit_paid':
        return wrap(`
<h2 style="color:#111827;margin:0 0 16px;">Teminat Onayı</h2>
<p>Merhaba ${firstName},</p>
<p>İhale için teminat ödemeniz başarıyla alınmıştır.</p>
<table style="width:100%;border-collapse:collapse;margin:16px 0;">
<tr><td style="padding:8px;border-bottom:1px solid #e5e7eb;color:#6b7280;">İhale</td><td style="padding:8px;border-bottom:1px solid #e5e7eb;font-weight:600;">${data.auctionTitle || '—'}</td></tr>
<tr><td style="padding:8px;border-bottom:1px solid #e5e7eb;color:#6b7280;">Teminat Tutarı</td><td style="padding:8px;border-bottom:1px solid #e5e7eb;font-weight:600;">${data.amount || '—'} ${data.currency || 'TRY'}</td></tr>
</table>
<p>İhale başladığında teklif vermeye hazır olacaksınız.</p>`);

      case 'auction.bid_placed':
        return wrap(`
<h2 style="color:#111827;margin:0 0 16px;">Teklif Onayı</h2>
<p>Merhaba ${firstName},</p>
<p>Teklifiniz başarıyla kaydedildi.</p>
<table style="width:100%;border-collapse:collapse;margin:16px 0;">
<tr><td style="padding:8px;border-bottom:1px solid #e5e7eb;color:#6b7280;">İhale</td><td style="padding:8px;border-bottom:1px solid #e5e7eb;font-weight:600;">${data.auctionTitle || '—'}</td></tr>
<tr><td style="padding:8px;border-bottom:1px solid #e5e7eb;color:#6b7280;">Teklif Tutarı</td><td style="padding:8px;border-bottom:1px solid #e5e7eb;font-weight:600;color:#16a34a;">${data.bidAmount || '—'} ${data.currency || 'TRY'}</td></tr>
</table>
<p style="color:#6b7280;font-size:13px;">Daha yüksek bir teklif verildiğinde bilgilendirileceksiniz.</p>`);

      case 'auction.won':
        return wrap(`
<h2 style="color:#16a34a;margin:0 0 16px;">Tebrikler! İhaleyi Kazandınız 🎉</h2>
<p>Merhaba ${firstName},</p>
<p>Harika haber! <strong>${data.auctionTitle || 'İhale'}</strong> için en yüksek teklifi siz verdiniz ve ihaleyi kazandınız.</p>
<table style="width:100%;border-collapse:collapse;margin:16px 0;">
<tr><td style="padding:8px;border-bottom:1px solid #e5e7eb;color:#6b7280;">Kazanan Teklif</td><td style="padding:8px;border-bottom:1px solid #e5e7eb;font-weight:600;color:#16a34a;">${data.winningBid || '—'} ${data.currency || 'TRY'}</td></tr>
</table>
<p>Ekibimiz sizinle kısa sürede iletişime geçecektir. Satış süreciyle ilgili detaylı bilgi verilecektir.</p>`);

      case 'auction.lost':
        return wrap(`
<h2 style="color:#111827;margin:0 0 16px;">İhale Sonucu</h2>
<p>Merhaba ${firstName},</p>
<p><strong>${data.auctionTitle || 'İhale'}</strong> sona erdi. Maalesef bu kez kazanan teklif sizinkinden farklı oldu.</p>
<p>Diğer aktif ihalelere göz atarak yeni fırsatlar yakalayabilirsiniz.</p>
<a href="${data.siteUrl || 'https://nettapu.com'}/auctions" style="display:inline-block;background:#16a34a;color:#fff;padding:12px 24px;border-radius:6px;text-decoration:none;font-weight:600;margin:8px 0;">Aktif İhaleleri Gör</a>`);

      case 'auction.starting_soon':
        return wrap(`
<h2 style="color:#111827;margin:0 0 16px;">İhale Hatırlatması ⏰</h2>
<p>Merhaba ${firstName},</p>
<p>Katılmak istediğiniz <strong>${data.auctionTitle || 'ihale'}</strong> kısa süre içinde başlıyor!</p>
<table style="width:100%;border-collapse:collapse;margin:16px 0;">
<tr><td style="padding:8px;border-bottom:1px solid #e5e7eb;color:#6b7280;">Başlangıç</td><td style="padding:8px;border-bottom:1px solid #e5e7eb;font-weight:600;">${data.startTime || '—'}</td></tr>
<tr><td style="padding:8px;border-bottom:1px solid #e5e7eb;color:#6b7280;">Başlangıç Fiyatı</td><td style="padding:8px;border-bottom:1px solid #e5e7eb;font-weight:600;">${data.startingPrice || '—'} ${data.currency || 'TRY'}</td></tr>
</table>
<a href="${data.siteUrl || 'https://nettapu.com'}/auctions/${data.auctionId || ''}" style="display:inline-block;background:#16a34a;color:#fff;padding:12px 24px;border-radius:6px;text-decoration:none;font-weight:600;margin:8px 0;">İhaleye Katıl</a>`);

      case 'payment.success':
        return wrap(`
<h2 style="color:#16a34a;margin:0 0 16px;">Ödeme Onayı ✓</h2>
<p>Merhaba ${firstName},</p>
<p>Ödemeniz başarıyla gerçekleştirildi.</p>
<table style="width:100%;border-collapse:collapse;margin:16px 0;">
<tr><td style="padding:8px;border-bottom:1px solid #e5e7eb;color:#6b7280;">Tutar</td><td style="padding:8px;border-bottom:1px solid #e5e7eb;font-weight:600;color:#16a34a;">${data.amount || '—'} ${data.currency || 'TRY'}</td></tr>
<tr><td style="padding:8px;border-bottom:1px solid #e5e7eb;color:#6b7280;">İşlem No</td><td style="padding:8px;border-bottom:1px solid #e5e7eb;font-family:monospace;">${data.transactionId || '—'}</td></tr>
${data.description ? `<tr><td style="padding:8px;border-bottom:1px solid #e5e7eb;color:#6b7280;">Açıklama</td><td style="padding:8px;border-bottom:1px solid #e5e7eb;">${data.description}</td></tr>` : ''}
</table>`);

      case 'payment.failed':
        return wrap(`
<h2 style="color:#dc2626;margin:0 0 16px;">Ödeme Başarısız</h2>
<p>Merhaba ${firstName},</p>
<p>Ödemeniz işlenirken bir sorunla karşılaşıldı.</p>
<table style="width:100%;border-collapse:collapse;margin:16px 0;">
<tr><td style="padding:8px;border-bottom:1px solid #e5e7eb;color:#6b7280;">Tutar</td><td style="padding:8px;border-bottom:1px solid #e5e7eb;font-weight:600;">${data.amount || '—'} ${data.currency || 'TRY'}</td></tr>
${data.reason ? `<tr><td style="padding:8px;border-bottom:1px solid #e5e7eb;color:#6b7280;">Hata</td><td style="padding:8px;border-bottom:1px solid #e5e7eb;color:#dc2626;">${data.reason}</td></tr>` : ''}
</table>
<p>Lütfen ödeme bilgilerinizi kontrol ederek tekrar deneyin veya destek ekibimizle iletişime geçin.</p>`);

      case 'offer.received':
        return wrap(`
<h2 style="color:#111827;margin:0 0 16px;">Yeni Teklif Aldınız</h2>
<p>Merhaba ${firstName},</p>
<p>İlanınız için yeni bir teklif aldınız.</p>
<table style="width:100%;border-collapse:collapse;margin:16px 0;">
<tr><td style="padding:8px;border-bottom:1px solid #e5e7eb;color:#6b7280;">İlan</td><td style="padding:8px;border-bottom:1px solid #e5e7eb;font-weight:600;">${data.parcelTitle || '—'}</td></tr>
<tr><td style="padding:8px;border-bottom:1px solid #e5e7eb;color:#6b7280;">Teklif Tutarı</td><td style="padding:8px;border-bottom:1px solid #e5e7eb;font-weight:600;color:#16a34a;">${data.offerAmount || '—'} ${data.currency || 'TRY'}</td></tr>
${data.message ? `<tr><td style="padding:8px;border-bottom:1px solid #e5e7eb;color:#6b7280;">Mesaj</td><td style="padding:8px;border-bottom:1px solid #e5e7eb;">${data.message}</td></tr>` : ''}
</table>
<p>Teklifi incelemek için giriş yapın.</p>`);

      case 'offer.accepted':
        return wrap(`
<h2 style="color:#16a34a;margin:0 0 16px;">Teklifiniz Kabul Edildi! ✓</h2>
<p>Merhaba ${firstName},</p>
<p>Tebrikler! <strong>${data.parcelTitle || 'İlan'}</strong> için verdiğiniz teklif kabul edildi.</p>
<table style="width:100%;border-collapse:collapse;margin:16px 0;">
<tr><td style="padding:8px;border-bottom:1px solid #e5e7eb;color:#6b7280;">Kabul Edilen Tutar</td><td style="padding:8px;border-bottom:1px solid #e5e7eb;font-weight:600;color:#16a34a;">${data.offerAmount || '—'} ${data.currency || 'TRY'}</td></tr>
</table>
<p>Ekibimiz sizinle en kısa sürede iletişime geçerek sonraki adımlar hakkında bilgi verecektir.</p>`);

      case 'offer.rejected':
        return wrap(`
<h2 style="color:#111827;margin:0 0 16px;">Teklif Sonucu</h2>
<p>Merhaba ${firstName},</p>
<p><strong>${data.parcelTitle || 'İlan'}</strong> için verdiğiniz teklif maalesef kabul edilmedi.</p>
${data.reason ? `<p>Gerekçe: ${data.reason}</p>` : ''}
<p>Diğer ilanları inceleyerek yeni fırsatlar keşfedebilirsiniz.</p>
<a href="${data.siteUrl || 'https://nettapu.com'}/parcels" style="display:inline-block;background:#16a34a;color:#fff;padding:12px 24px;border-radius:6px;text-decoration:none;font-weight:600;margin:8px 0;">İlanları Gör</a>`);

      case 'offer.countered':
        return wrap(`
<h2 style="color:#2563eb;margin:0 0 16px;">Karşı Teklif Aldınız</h2>
<p>Merhaba ${firstName},</p>
<p><strong>${data.parcelTitle || 'İlan'}</strong> için verdiğiniz teklife karşı bir teklif geldi.</p>
<table style="width:100%;border-collapse:collapse;margin:16px 0;">
<tr><td style="padding:8px;border-bottom:1px solid #e5e7eb;color:#6b7280;">Sizin Teklifiniz</td><td style="padding:8px;border-bottom:1px solid #e5e7eb;">${data.originalAmount || '—'} ${data.currency || 'TRY'}</td></tr>
<tr><td style="padding:8px;border-bottom:1px solid #e5e7eb;color:#6b7280;">Karşı Teklif</td><td style="padding:8px;border-bottom:1px solid #e5e7eb;font-weight:600;color:#2563eb;">${data.counterAmount || '—'} ${data.currency || 'TRY'}</td></tr>
</table>
<p>Karşı teklifi değerlendirmek için giriş yapın.</p>`);

      case 'appointment.scheduled':
        return wrap(`
<h2 style="color:#111827;margin:0 0 16px;">Randevunuz Oluşturuldu</h2>
<p>Merhaba ${firstName},</p>
<p>Randevunuz başarıyla planlandı.</p>
<table style="width:100%;border-collapse:collapse;margin:16px 0;">
<tr><td style="padding:8px;border-bottom:1px solid #e5e7eb;color:#6b7280;">Tarih</td><td style="padding:8px;border-bottom:1px solid #e5e7eb;font-weight:600;">${data.scheduledAt || '—'}</td></tr>
${data.location ? `<tr><td style="padding:8px;border-bottom:1px solid #e5e7eb;color:#6b7280;">Konum</td><td style="padding:8px;border-bottom:1px solid #e5e7eb;">${data.location}</td></tr>` : ''}
${data.notes ? `<tr><td style="padding:8px;border-bottom:1px solid #e5e7eb;color:#6b7280;">Notlar</td><td style="padding:8px;border-bottom:1px solid #e5e7eb;">${data.notes}</td></tr>` : ''}
</table>`);

      case 'appointment.reminder':
        return wrap(`
<h2 style="color:#111827;margin:0 0 16px;">Randevu Hatırlatması ⏰</h2>
<p>Merhaba ${firstName},</p>
<p>Randevunuzun zamanı yaklaşıyor!</p>
<table style="width:100%;border-collapse:collapse;margin:16px 0;">
<tr><td style="padding:8px;border-bottom:1px solid #e5e7eb;color:#6b7280;">Tarih</td><td style="padding:8px;border-bottom:1px solid #e5e7eb;font-weight:600;">${data.scheduledAt || '—'}</td></tr>
${data.location ? `<tr><td style="padding:8px;border-bottom:1px solid #e5e7eb;color:#6b7280;">Konum</td><td style="padding:8px;border-bottom:1px solid #e5e7eb;">${data.location}</td></tr>` : ''}
</table>`);

      case 'appointment.cancelled':
        return wrap(`
<h2 style="color:#dc2626;margin:0 0 16px;">Randevu İptali</h2>
<p>Merhaba ${firstName},</p>
<p>Aşağıdaki randevunuz iptal edilmiştir.</p>
<table style="width:100%;border-collapse:collapse;margin:16px 0;">
<tr><td style="padding:8px;border-bottom:1px solid #e5e7eb;color:#6b7280;">Tarih</td><td style="padding:8px;border-bottom:1px solid #e5e7eb;">${data.scheduledAt || '—'}</td></tr>
${data.reason ? `<tr><td style="padding:8px;border-bottom:1px solid #e5e7eb;color:#6b7280;">Sebep</td><td style="padding:8px;border-bottom:1px solid #e5e7eb;">${data.reason}</td></tr>` : ''}
</table>
<p>Yeni bir randevu almak için lütfen iletişime geçin.</p>`);

      case 'contact.received':
        return wrap(`
<h2 style="color:#111827;margin:0 0 16px;">Talebiniz Alındı</h2>
<p>Merhaba ${firstName},</p>
<p>İletişim talebiniz başarıyla alınmıştır. Ekibimiz en kısa sürede sizinle iletişime geçecektir.</p>
${data.message ? `<p style="background:#f3f4f6;border-radius:6px;padding:12px;margin:16px 0;font-style:italic;">${data.message}</p>` : ''}
<p style="color:#6b7280;font-size:13px;">Genellikle 24 saat içinde dönüş yapılmaktadır.</p>`);

      default:
        return wrap(`
<p>Merhaba ${firstName},</p>
<p>${data.body || JSON.stringify(data)}</p>`);
    }
  }
}
