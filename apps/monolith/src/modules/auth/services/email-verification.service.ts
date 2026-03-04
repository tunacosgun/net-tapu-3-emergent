import {
  Injectable,
  BadRequestException,
  Logger,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository, IsNull, MoreThan, DataSource } from 'typeorm';
import * as crypto from 'crypto';
import { User } from '../entities/user.entity';
import { EmailVerificationToken } from '../entities/email-verification-token.entity';
import { NotificationQueue } from '../../crm/entities/notification-queue.entity';

const MAX_ACTIVE_TOKENS = 3;

@Injectable()
export class EmailVerificationService {
  private readonly logger = new Logger(EmailVerificationService.name);
  private readonly tokenExpiryHours: number;

  constructor(
    @InjectRepository(User)
    private readonly userRepo: Repository<User>,
    @InjectRepository(EmailVerificationToken)
    private readonly tokenRepo: Repository<EmailVerificationToken>,
    @InjectRepository(NotificationQueue)
    private readonly notificationQueueRepo: Repository<NotificationQueue>,
    private readonly dataSource: DataSource,
    private readonly config: ConfigService,
  ) {
    this.tokenExpiryHours = this.config.get<number>(
      'EMAIL_VERIFICATION_EXPIRY_HOURS',
      24,
    );
  }

  async sendVerification(userId: string): Promise<void> {
    const user = await this.userRepo.findOne({ where: { id: userId } });

    if (!user) {
      throw new BadRequestException('Kullanıcı bulunamadı');
    }

    if (user.isVerified) {
      throw new BadRequestException('E-posta zaten doğrulanmış');
    }

    // Rate limit
    const activeCount = await this.tokenRepo.count({
      where: {
        userId: user.id,
        usedAt: IsNull(),
        expiresAt: MoreThan(new Date()),
      },
    });

    if (activeCount >= MAX_ACTIVE_TOKENS) {
      throw new BadRequestException('Çok fazla doğrulama isteği gönderildi. Lütfen bekleyin.');
    }

    const rawToken = crypto.randomBytes(32).toString('hex');
    const tokenHash = crypto.createHash('sha256').update(rawToken).digest('hex');

    const expiresAt = new Date();
    expiresAt.setHours(expiresAt.getHours() + this.tokenExpiryHours);

    await this.tokenRepo.save(
      this.tokenRepo.create({
        userId: user.id,
        tokenHash,
        expiresAt,
      }),
    );

    // Queue verification email
    await this.notificationQueueRepo.save(
      this.notificationQueueRepo.create({
        userId: user.id,
        channel: 'email',
        subject: 'E-posta Doğrulama',
        body: JSON.stringify({
          template: 'email_verification',
          firstName: user.firstName,
          verificationToken: rawToken,
          expiresInHours: this.tokenExpiryHours,
        }),
        metadata: { event: 'user.email_verification' },
        scheduledFor: new Date(),
      }),
    );

    this.logger.log(`Verification email queued for user ${user.id}`);
  }

  async verifyEmail(rawToken: string): Promise<{ message: string }> {
    const tokenHash = crypto.createHash('sha256').update(rawToken).digest('hex');

    // Transaction with pessimistic lock to prevent replay
    return this.dataSource.transaction(async (manager) => {
      const storedToken = await manager
        .getRepository(EmailVerificationToken)
        .createQueryBuilder('t')
        .setLock('pessimistic_write')
        .where('t.token_hash = :tokenHash', { tokenHash })
        .getOne();

      if (!storedToken) {
        throw new BadRequestException('Geçersiz doğrulama bağlantısı');
      }

      if (storedToken.usedAt) {
        throw new BadRequestException('Bu doğrulama bağlantısı zaten kullanılmış');
      }

      if (storedToken.expiresAt < new Date()) {
        throw new BadRequestException('Doğrulama bağlantısının süresi dolmuş');
      }

      const user = await manager
        .getRepository(User)
        .findOne({ where: { id: storedToken.userId } });

      if (!user) {
        throw new BadRequestException('Kullanıcı bulunamadı');
      }

      // Atomic: mark verified + mark token used + invalidate siblings
      await manager.getRepository(User).update(user.id, { isVerified: true });

      await manager
        .getRepository(EmailVerificationToken)
        .update(storedToken.id, { usedAt: new Date() });

      await manager
        .getRepository(EmailVerificationToken)
        .createQueryBuilder()
        .update()
        .set({ usedAt: new Date() })
        .where('user_id = :userId AND used_at IS NULL AND id != :id', {
          userId: user.id,
          id: storedToken.id,
        })
        .execute();

      this.logger.log(`Email verified for user ${user.id}`);
      return { message: 'E-posta başarıyla doğrulandı' };
    });
  }
}
