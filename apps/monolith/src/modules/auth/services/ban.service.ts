import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository, MoreThan } from 'typeorm';
import { IpBan } from '../entities/ip-ban.entity';
import { LoginAttempt } from '../entities/login-attempt.entity';

const DEFAULT_LOCKOUT_THRESHOLD = 5;
const DEFAULT_LOCKOUT_WINDOW_MINUTES = 15;
const DEFAULT_LOCKOUT_DURATION_MINUTES = 30;

@Injectable()
export class BanService {
  private readonly logger = new Logger(BanService.name);
  private readonly lockoutThreshold: number;
  private readonly lockoutWindowMinutes: number;
  private readonly lockoutDurationMinutes: number;

  constructor(
    @InjectRepository(IpBan)
    private readonly banRepo: Repository<IpBan>,
    @InjectRepository(LoginAttempt)
    private readonly loginAttemptRepo: Repository<LoginAttempt>,
    private readonly config: ConfigService,
  ) {
    this.lockoutThreshold = this.config.get<number>('LOGIN_LOCKOUT_THRESHOLD', DEFAULT_LOCKOUT_THRESHOLD);
    this.lockoutWindowMinutes = this.config.get<number>('LOGIN_LOCKOUT_WINDOW_MINUTES', DEFAULT_LOCKOUT_WINDOW_MINUTES);
    this.lockoutDurationMinutes = this.config.get<number>('LOGIN_LOCKOUT_DURATION_MINUTES', DEFAULT_LOCKOUT_DURATION_MINUTES);
  }

  /**
   * Check if an IP or user is banned.
   * Returns the ban reason if banned, null otherwise.
   */
  async checkBan(ipAddress?: string, userId?: string): Promise<{ reason: string; type: 'ip' | 'user'; expiresAt: Date | null; restrictedFeatures: string[] } | null> {
    const now = new Date();
    const conditions: string[] = [];
    const params: Record<string, unknown> = {};

    if (ipAddress) {
      conditions.push('(b.ip_address = :ip)');
      params.ip = ipAddress;
    }

    if (userId) {
      conditions.push('(b.user_id = :userId)');
      params.userId = userId;
    }

    if (conditions.length === 0) return null;

    const ban = await this.banRepo
      .createQueryBuilder('b')
      .where(`b.is_active = true AND (${conditions.join(' OR ')})`)
      .andWhere('(b.expires_at IS NULL OR b.expires_at > :now)', { ...params, now })
      .orderBy('b.created_at', 'DESC')
      .getOne();

    if (!ban) return null;

    const type = ban.userId ? 'user' : 'ip';
    return { reason: ban.reason, type, expiresAt: ban.expiresAt, restrictedFeatures: ban.restrictedFeatures || ['full'] };
  }

  /**
   * Check if a specific feature is banned for an IP/user.
   */
  async checkFeatureBan(ipAddress?: string, userId?: string, feature?: string): Promise<{ reason: string; type: 'ip' | 'user'; expiresAt: Date | null; restrictedFeatures: string[] } | null> {
    const ban = await this.checkBan(ipAddress, userId);
    if (!ban) return null;
    const features = ban.restrictedFeatures;
    if (features.includes('full') || (feature && features.includes(feature))) {
      return ban;
    }
    return null;
  }

  /**
   * Get all active bans for a user (for ban-status endpoint).
   */
  async getUserBanStatus(ipAddress?: string, userId?: string): Promise<{ banned: boolean; bans: { reason: string; restrictedFeatures: string[]; expiresAt: Date | null }[] }> {
    const now = new Date();
    const conditions: string[] = [];
    const params: Record<string, unknown> = {};

    if (ipAddress) {
      conditions.push('(b.ip_address = :ip)');
      params.ip = ipAddress;
    }
    if (userId) {
      conditions.push('(b.user_id = :userId)');
      params.userId = userId;
    }
    if (conditions.length === 0) return { banned: false, bans: [] };

    const bans = await this.banRepo
      .createQueryBuilder('b')
      .where(`b.is_active = true AND (${conditions.join(' OR ')})`)
      .andWhere('(b.expires_at IS NULL OR b.expires_at > :now)', { ...params, now })
      .orderBy('b.created_at', 'DESC')
      .getMany();

    if (bans.length === 0) return { banned: false, bans: [] };

    return {
      banned: true,
      bans: bans.map(b => ({
        reason: b.reason,
        restrictedFeatures: b.restrictedFeatures || ['full'],
        expiresAt: b.expiresAt,
      })),
    };
  }

  /**
   * Record a login attempt and check if auto-lockout should be triggered.
   */
  async recordLoginAttempt(
    email: string,
    success: boolean,
    ipAddress?: string,
    userAgent?: string,
  ): Promise<{ locked: boolean }> {
    await this.loginAttemptRepo.save(
      this.loginAttemptRepo.create({
        email,
        ipAddress: ipAddress ?? null,
        userAgent: userAgent ?? null,
        success,
      }),
    );

    if (success) return { locked: false };

    // Check failed attempts in the window
    const windowStart = new Date();
    windowStart.setMinutes(windowStart.getMinutes() - this.lockoutWindowMinutes);

    const failedCount = await this.loginAttemptRepo.count({
      where: {
        email,
        success: false,
        createdAt: MoreThan(windowStart),
      },
    });

    if (failedCount >= this.lockoutThreshold) {
      // Auto-lockout: create temporary IP ban
      if (ipAddress) {
        const expiresAt = new Date();
        expiresAt.setMinutes(expiresAt.getMinutes() + this.lockoutDurationMinutes);

        const existingBan = await this.banRepo.findOne({
          where: { ipAddress, isActive: true },
        });

        if (!existingBan) {
          await this.banRepo.save(
            this.banRepo.create({
              ipAddress,
              reason: `Otomatik kilitlendi: ${failedCount} başarısız giriş denemesi (${email})`,
              expiresAt,
            }),
          );

          this.logger.warn(
            `Auto-locked IP ${ipAddress} for ${this.lockoutDurationMinutes}min after ${failedCount} failed attempts on ${email}`,
          );
        }
      }

      return { locked: true };
    }

    return { locked: false };
  }

  /**
   * Admin: list login attempts.
   */
  async listLoginAttempts(
    page = 1,
    limit = 50,
    email?: string,
  ): Promise<{ data: LoginAttempt[]; total: number }> {
    const qb = this.loginAttemptRepo.createQueryBuilder('la');

    if (email) {
      qb.where('la.email ILIKE :email', { email: `%${email}%` });
    }

    qb.orderBy('la.created_at', 'DESC')
      .skip((page - 1) * limit)
      .take(limit);

    const [data, total] = await qb.getManyAndCount();
    return { data, total };
  }

  /**
   * Admin: create a ban.
   */
  async createBan(params: {
    ipAddress?: string;
    userId?: string;
    reason: string;
    bannedBy: string;
    expiresAt?: Date;
    restrictedFeatures?: string[];
  }): Promise<IpBan> {
    const ban = this.banRepo.create({
      ipAddress: params.ipAddress ?? null,
      userId: params.userId ?? null,
      reason: params.reason,
      bannedBy: params.bannedBy,
      expiresAt: params.expiresAt ?? null,
      restrictedFeatures: params.restrictedFeatures ?? ['full'],
    });

    const saved = await this.banRepo.save(ban);
    this.logger.log(
      `Ban created by ${params.bannedBy}: IP=${params.ipAddress}, user=${params.userId}, reason=${params.reason}`,
    );
    return saved;
  }

  /**
   * Admin: lift a ban.
   */
  async liftBan(banId: string, liftedBy: string): Promise<void> {
    await this.banRepo.update(banId, { isActive: false });
    this.logger.log(`Ban ${banId} lifted by ${liftedBy}`);
  }

  /**
   * Admin: list active bans.
   */
  async listBans(page = 1, limit = 20): Promise<{ data: IpBan[]; total: number }> {
    const [data, total] = await this.banRepo.findAndCount({
      where: { isActive: true },
      order: { createdAt: 'DESC' },
      skip: (page - 1) * limit,
      take: limit,
    });

    return { data, total };
  }
}
