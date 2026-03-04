import {
  Injectable,
  BadRequestException,
  Logger,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository, IsNull, MoreThan, DataSource } from 'typeorm';
import * as bcrypt from 'bcrypt';
import * as crypto from 'crypto';
import { User } from '../entities/user.entity';
import { PasswordResetToken } from '../entities/password-reset-token.entity';
import { NotificationQueue } from '../../crm/entities/notification-queue.entity';

const BCRYPT_ROUNDS = 12;
const MAX_ACTIVE_TOKENS = 3;

@Injectable()
export class PasswordResetService {
  private readonly logger = new Logger(PasswordResetService.name);
  private readonly tokenExpiryMinutes: number;

  constructor(
    @InjectRepository(User)
    private readonly userRepo: Repository<User>,
    @InjectRepository(PasswordResetToken)
    private readonly tokenRepo: Repository<PasswordResetToken>,
    @InjectRepository(NotificationQueue)
    private readonly notificationQueueRepo: Repository<NotificationQueue>,
    private readonly dataSource: DataSource,
    private readonly config: ConfigService,
  ) {
    this.tokenExpiryMinutes = this.config.get<number>(
      'PASSWORD_RESET_EXPIRY_MINUTES',
      30,
    );
  }

  async requestReset(email: string): Promise<void> {
    // Constant-time: always do a dummy hash to prevent timing-based enumeration
    const dummyHash = bcrypt.hash('dummy_password_for_timing', BCRYPT_ROUNDS);

    const user = await this.userRepo.findOne({ where: { email } });

    if (!user || !user.isActive) {
      // Await the dummy hash to normalize response time
      await dummyHash;
      this.logger.debug(`Password reset requested for unknown/inactive email`);
      return;
    }

    // Rate limit: max N active tokens per user
    const activeCount = await this.tokenRepo.count({
      where: {
        userId: user.id,
        usedAt: IsNull(),
        expiresAt: MoreThan(new Date()),
      },
    });

    if (activeCount >= MAX_ACTIVE_TOKENS) {
      await dummyHash;
      this.logger.warn(`Password reset rate limit hit for user ${user.id}`);
      return;
    }

    // Generate token
    const rawToken = crypto.randomBytes(32).toString('hex');
    const tokenHash = crypto.createHash('sha256').update(rawToken).digest('hex');

    const expiresAt = new Date();
    expiresAt.setMinutes(expiresAt.getMinutes() + this.tokenExpiryMinutes);

    await this.tokenRepo.save(
      this.tokenRepo.create({
        userId: user.id,
        tokenHash,
        expiresAt,
      }),
    );

    // Queue notification email
    await this.notificationQueueRepo.save(
      this.notificationQueueRepo.create({
        userId: user.id,
        channel: 'email',
        subject: 'Şifre Sıfırlama',
        body: JSON.stringify({
          template: 'password_reset',
          firstName: user.firstName,
          resetToken: rawToken,
          expiresInMinutes: this.tokenExpiryMinutes,
        }),
        metadata: { event: 'user.password_reset_requested' },
        scheduledFor: new Date(),
      }),
    );

    this.logger.log(`Password reset token created for user ${user.id}`);
  }

  async resetPassword(rawToken: string, newPassword: string): Promise<void> {
    const tokenHash = crypto.createHash('sha256').update(rawToken).digest('hex');

    // Transaction with pessimistic lock to prevent replay
    await this.dataSource.transaction(async (manager) => {
      const storedToken = await manager
        .getRepository(PasswordResetToken)
        .createQueryBuilder('t')
        .setLock('pessimistic_write')
        .where('t.token_hash = :tokenHash', { tokenHash })
        .getOne();

      if (!storedToken) {
        throw new BadRequestException('Geçersiz sıfırlama bağlantısı');
      }

      if (storedToken.usedAt) {
        throw new BadRequestException('Bu sıfırlama bağlantısı zaten kullanılmış');
      }

      if (storedToken.expiresAt < new Date()) {
        throw new BadRequestException('Sıfırlama bağlantısının süresi dolmuş');
      }

      const user = await manager
        .getRepository(User)
        .findOne({ where: { id: storedToken.userId } });

      if (!user || !user.isActive) {
        throw new BadRequestException('Hesap bulunamadı veya devre dışı');
      }

      // Atomic: update password + mark token used + invalidate siblings
      const passwordHash = await bcrypt.hash(newPassword, BCRYPT_ROUNDS);
      await manager.getRepository(User).update(user.id, { passwordHash });

      await manager
        .getRepository(PasswordResetToken)
        .update(storedToken.id, { usedAt: new Date() });

      // Invalidate all other active reset tokens for this user
      await manager
        .getRepository(PasswordResetToken)
        .createQueryBuilder()
        .update()
        .set({ usedAt: new Date() })
        .where('user_id = :userId AND used_at IS NULL AND id != :id', {
          userId: user.id,
          id: storedToken.id,
        })
        .execute();
    });

    this.logger.log(`Password reset completed via token`);
  }
}
