import { Test, TestingModule } from '@nestjs/testing';
import { getRepositoryToken } from '@nestjs/typeorm';
import { DataSource } from 'typeorm';
import { BadRequestException } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import * as crypto from 'crypto';
import { PasswordResetService } from '../password-reset.service';
import { User } from '../../entities/user.entity';
import { PasswordResetToken } from '../../entities/password-reset-token.entity';
import { NotificationQueue } from '../../../crm/entities/notification-queue.entity';

describe('PasswordResetService', () => {
  let service: PasswordResetService;

  const mockUserRepo = {
    findOne: jest.fn(),
    update: jest.fn(),
  };

  const mockTokenRepo = {
    findOne: jest.fn(),
    count: jest.fn(),
    save: jest.fn(),
    create: jest.fn().mockImplementation((v) => v),
    update: jest.fn(),
    createQueryBuilder: jest.fn(),
  };

  const mockNotificationQueueRepo = {
    save: jest.fn(),
    create: jest.fn().mockImplementation((v) => v),
  };

  // Transaction mock
  const mockManager = {
    getRepository: jest.fn(),
  };

  const mockDataSource = {
    transaction: jest.fn().mockImplementation(async (cb) => cb(mockManager)),
  };

  const mockConfig = {
    get: jest.fn().mockReturnValue(30),
  };

  beforeEach(async () => {
    jest.clearAllMocks();

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        PasswordResetService,
        { provide: getRepositoryToken(User), useValue: mockUserRepo },
        { provide: getRepositoryToken(PasswordResetToken), useValue: mockTokenRepo },
        { provide: getRepositoryToken(NotificationQueue), useValue: mockNotificationQueueRepo },
        { provide: DataSource, useValue: mockDataSource },
        { provide: ConfigService, useValue: mockConfig },
      ],
    }).compile();

    service = module.get<PasswordResetService>(PasswordResetService);
  });

  describe('requestReset', () => {
    it('should return silently when email does not exist (no enumeration)', async () => {
      mockUserRepo.findOne.mockResolvedValue(null);

      // Should NOT throw
      await expect(service.requestReset('nonexistent@test.com')).resolves.toBeUndefined();

      // Should NOT queue any notification
      expect(mockNotificationQueueRepo.save).not.toHaveBeenCalled();
    });

    it('should return silently when user is inactive', async () => {
      mockUserRepo.findOne.mockResolvedValue({ id: 'u1', isActive: false });

      await expect(service.requestReset('inactive@test.com')).resolves.toBeUndefined();
      expect(mockNotificationQueueRepo.save).not.toHaveBeenCalled();
    });
  });

  describe('resetPassword', () => {
    const rawToken = crypto.randomBytes(32).toString('hex');
    const tokenHash = crypto.createHash('sha256').update(rawToken).digest('hex');

    let mockTokenRepoInTx: Record<string, jest.Mock>;
    let mockUserRepoInTx: Record<string, jest.Mock>;

    beforeEach(() => {
      mockTokenRepoInTx = {
        createQueryBuilder: jest.fn().mockReturnValue({
          setLock: jest.fn().mockReturnThis(),
          where: jest.fn().mockReturnThis(),
          getOne: jest.fn(),
          update: jest.fn().mockReturnThis(),
          set: jest.fn().mockReturnThis(),
          execute: jest.fn(),
        }),
        update: jest.fn(),
      };

      mockUserRepoInTx = {
        findOne: jest.fn(),
        update: jest.fn(),
      };

      mockManager.getRepository.mockImplementation((entity: unknown) => {
        if (entity === PasswordResetToken) return mockTokenRepoInTx;
        if (entity === User) return mockUserRepoInTx;
        return {};
      });
    });

    it('should throw on invalid (nonexistent) token', async () => {
      const qb = mockTokenRepoInTx.createQueryBuilder();
      qb.getOne.mockResolvedValue(null);

      await expect(service.resetPassword('invalid_token', 'NewPass123!')).rejects.toThrow(
        BadRequestException,
      );
    });

    it('should throw on already-used token (replay protection)', async () => {
      const qb = mockTokenRepoInTx.createQueryBuilder();
      qb.getOne.mockResolvedValue({
        id: 't1',
        tokenHash,
        userId: 'u1',
        usedAt: new Date(), // already used
        expiresAt: new Date(Date.now() + 60000),
      });

      await expect(service.resetPassword(rawToken, 'NewPass123!')).rejects.toThrow(
        'Bu sıfırlama bağlantısı zaten kullanılmış',
      );
    });

    it('should throw on expired token', async () => {
      const qb = mockTokenRepoInTx.createQueryBuilder();
      qb.getOne.mockResolvedValue({
        id: 't1',
        tokenHash,
        userId: 'u1',
        usedAt: null,
        expiresAt: new Date(Date.now() - 60000), // expired
      });

      await expect(service.resetPassword(rawToken, 'NewPass123!')).rejects.toThrow(
        'Sıfırlama bağlantısının süresi dolmuş',
      );
    });

    it('should succeed with valid token and update password', async () => {
      const qb = mockTokenRepoInTx.createQueryBuilder();
      qb.getOne.mockResolvedValue({
        id: 't1',
        tokenHash,
        userId: 'u1',
        usedAt: null,
        expiresAt: new Date(Date.now() + 600000),
      });

      mockUserRepoInTx.findOne.mockResolvedValue({
        id: 'u1',
        isActive: true,
      });

      await expect(service.resetPassword(rawToken, 'NewPass123!')).resolves.toBeUndefined();

      // Password should be updated
      expect(mockUserRepoInTx.update).toHaveBeenCalledWith('u1', expect.objectContaining({
        passwordHash: expect.any(String),
      }));

      // Token should be marked used
      expect(mockTokenRepoInTx.update).toHaveBeenCalledWith('t1', expect.objectContaining({
        usedAt: expect.any(Date),
      }));
    });
  });
});
