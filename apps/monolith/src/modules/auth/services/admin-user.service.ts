import { Injectable, Logger } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import * as bcrypt from 'bcrypt';
import { User } from '../entities/user.entity';
import { RefreshToken } from '../entities/refresh-token.entity';
import { LoginAttempt } from '../entities/login-attempt.entity';
import { UserRole } from '../entities/user-role.entity';

@Injectable()
export class AdminUserService {
  private readonly logger = new Logger(AdminUserService.name);

  constructor(
    @InjectRepository(User)
    private readonly userRepo: Repository<User>,
    @InjectRepository(RefreshToken)
    private readonly tokenRepo: Repository<RefreshToken>,
    @InjectRepository(LoginAttempt)
    private readonly attemptRepo: Repository<LoginAttempt>,
    @InjectRepository(UserRole)
    private readonly userRoleRepo: Repository<UserRole>,
  ) {}

  async listUsers(
    page = 1,
    limit = 20,
    search?: string,
  ): Promise<{ data: unknown[]; total: number }> {
    const qb = this.userRepo
      .createQueryBuilder('u')
      .select([
        'u.id',
        'u.email',
        'u.phone',
        'u.firstName',
        'u.lastName',
        'u.isVerified',
        'u.isActive',
        'u.lastLoginAt',
        'u.createdAt',
      ]);

    if (search) {
      qb.where(
        '(u.email ILIKE :s OR u.first_name ILIKE :s OR u.last_name ILIKE :s)',
        { s: `%${search}%` },
      );
    }

    qb.orderBy('u.created_at', 'DESC')
      .skip((page - 1) * limit)
      .take(limit);

    const [users, total] = await qb.getManyAndCount();

    // Fetch roles for all users in one query
    const userIds = users.map((u) => u.id);
    const roles =
      userIds.length > 0
        ? await this.userRoleRepo
            .createQueryBuilder('ur')
            .leftJoinAndSelect('ur.role', 'r')
            .where('ur.user_id IN (:...ids)', { ids: userIds })
            .getMany()
        : [];

    const roleMap = new Map<string, string[]>();
    for (const ur of roles) {
      const list = roleMap.get(ur.userId) || [];
      list.push(ur.role?.name || `role_${ur.roleId}`);
      roleMap.set(ur.userId, list);
    }

    const data = users.map((u) => ({
      ...u,
      roles: roleMap.get(u.id) || ['user'],
    }));

    return { data, total };
  }

  async getUserDetail(id: string) {
    const user = await this.userRepo.findOne({ where: { id } });
    if (!user) return null;

    const roles = await this.userRoleRepo
      .createQueryBuilder('ur')
      .leftJoinAndSelect('ur.role', 'r')
      .where('ur.user_id = :id', { id })
      .getMany();

    return {
      ...user,
      passwordHash: undefined,
      roles: roles.map((ur) => ur.role?.name || `role_${ur.roleId}`),
    };
  }

  async getUserSessions(userId: string): Promise<unknown[]> {
    const tokens = await this.tokenRepo.find({
      where: { userId },
      order: { createdAt: 'DESC' },
      take: 50,
    });

    return tokens.map((t) => ({
      id: t.id,
      deviceInfo: t.deviceInfo,
      ipAddress: t.ipAddress,
      createdAt: t.createdAt,
      expiresAt: t.expiresAt,
      revokedAt: t.revokedAt,
      isActive: !t.revokedAt && t.expiresAt > new Date(),
    }));
  }

  async getUserLoginHistory(
    userId: string,
    page = 1,
    limit = 50,
  ): Promise<{ data: LoginAttempt[]; total: number }> {
    // Get user email first
    const user = await this.userRepo.findOne({
      where: { id: userId },
      select: ['email'],
    });
    if (!user) return { data: [], total: 0 };

    const [data, total] = await this.attemptRepo.findAndCount({
      where: { email: user.email },
      order: { createdAt: 'DESC' },
      skip: (page - 1) * limit,
      take: limit,
    });

    return { data, total };
  }

  /**
   * Toggle user active status (freeze/unfreeze account).
   */
  async toggleUserActive(userId: string, adminId: string): Promise<{ isActive: boolean }> {
    const user = await this.userRepo.findOne({ where: { id: userId } });
    if (!user) throw new Error('Kullanıcı bulunamadı');

    const newStatus = !user.isActive;
    await this.userRepo.update(userId, { isActive: newStatus });

    // If deactivating, revoke all refresh tokens
    if (!newStatus) {
      await this.tokenRepo
        .createQueryBuilder()
        .update()
        .set({ revokedAt: new Date() })
        .where('user_id = :userId AND revoked_at IS NULL', { userId })
        .execute();
    }

    this.logger.log(`User ${userId} ${newStatus ? 'activated' : 'deactivated'} by admin ${adminId}`);
    return { isActive: newStatus };
  }

  /**
   * Admin reset user password.
   */
  async resetUserPassword(userId: string, newPassword: string, adminId: string): Promise<void> {
    const user = await this.userRepo.findOne({ where: { id: userId } });
    if (!user) throw new Error('Kullanıcı bulunamadı');

    const hash = await bcrypt.hash(newPassword, 12);
    await this.userRepo.update(userId, { passwordHash: hash });

    // Revoke all refresh tokens so user must re-login
    await this.tokenRepo
      .createQueryBuilder()
      .update()
      .set({ revokedAt: new Date() })
      .where('user_id = :userId AND revoked_at IS NULL', { userId })
      .execute();

    this.logger.log(`Password reset for user ${userId} by admin ${adminId}`);
  }

  /**
   * Delete user account (soft: deactivate + anonymize).
   */
  async deleteUser(userId: string, adminId: string): Promise<void> {
    const user = await this.userRepo.findOne({ where: { id: userId } });
    if (!user) throw new Error('Kullanıcı bulunamadı');

    // Revoke all tokens
    await this.tokenRepo
      .createQueryBuilder()
      .update()
      .set({ revokedAt: new Date() })
      .where('user_id = :userId AND revoked_at IS NULL', { userId })
      .execute();

    // Soft delete: deactivate and anonymize PII
    const anonSuffix = userId.slice(0, 8);
    await this.userRepo.update(userId, {
      isActive: false,
      email: `deleted_${anonSuffix}@nettapu.local`,
      firstName: 'Silinen',
      lastName: 'Kullanıcı',
      phone: null,
      passwordHash: 'DELETED',
    });

    this.logger.log(`User ${userId} deleted (anonymized) by admin ${adminId}`);
  }

  /**
   * Revoke all sessions for a user.
   */
  async revokeAllSessions(userId: string, adminId: string): Promise<{ count: number }> {
    const result = await this.tokenRepo
      .createQueryBuilder()
      .update()
      .set({ revokedAt: new Date() })
      .where('user_id = :userId AND revoked_at IS NULL', { userId })
      .execute();

    this.logger.log(`All sessions revoked for user ${userId} by admin ${adminId}`);
    return { count: result.affected || 0 };
  }
}
