import { Test, TestingModule } from '@nestjs/testing';
import { getRepositoryToken } from '@nestjs/typeorm';
import { DataSource } from 'typeorm';
import { BadRequestException } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import * as crypto from 'crypto';
import { EmailVerificationService } from '../email-verification.service';
import { User } from '../../entities/user.entity';
import { EmailVerificationToken } from '../../entities/email-verification-token.entity';
import { NotificationQueue } from '../../../crm/entities/notification-queue.entity';

describe('EmailVerificationService', () => {
  let service: EmailVerificationService;

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
  };

  const mockNotificationQueueRepo = {
    save: jest.fn(),
    create: jest.fn().mockImplementation((v) => v),
  };

  const mockManager = {
    getRepository: jest.fn(),
  };

  const mockDataSource = {
    transaction: jest.fn().mockImplementation(async (cb) => cb(mockManager)),
  };

  const mockConfig = {
    get: jest.fn().mockReturnValue(24),
  };

  let mockTokenRepoInTx: Record<string, jest.Mock>;
  let mockUserRepoInTx: Record<string, jest.Mock>;

  beforeEach(async () => {
    jest.clearAllMocks();

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
      if (entity === EmailVerificationToken) return mockTokenRepoInTx;
      if (entity === User) return mockUserRepoInTx;
      return {};
    });

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        EmailVerificationService,
        { provide: getRepositoryToken(User), useValue: mockUserRepo },
        { provide: getRepositoryToken(EmailVerificationToken), useValue: mockTokenRepo },
        { provide: getRepositoryToken(NotificationQueue), useValue: mockNotificationQueueRepo },
        { provide: DataSource, useValue: mockDataSource },
        { provide: ConfigService, useValue: mockConfig },
      ],
    }).compile();

    service = module.get<EmailVerificationService>(EmailVerificationService);
  });

  describe('verifyEmail', () => {
    const rawToken = crypto.randomBytes(32).toString('hex');

    it('should throw on invalid (nonexistent) token', async () => {
      const qb = mockTokenRepoInTx.createQueryBuilder();
      qb.getOne.mockResolvedValue(null);

      await expect(service.verifyEmail('invalid_token')).rejects.toThrow(BadRequestException);
    });

    it('should throw on already-used token (replay protection)', async () => {
      const qb = mockTokenRepoInTx.createQueryBuilder();
      qb.getOne.mockResolvedValue({
        id: 't1',
        userId: 'u1',
        usedAt: new Date(), // already used
        expiresAt: new Date(Date.now() + 60000),
      });

      await expect(service.verifyEmail(rawToken)).rejects.toThrow(
        'Bu doğrulama bağlantısı zaten kullanılmış',
      );
    });

    it('should throw on expired token', async () => {
      const qb = mockTokenRepoInTx.createQueryBuilder();
      qb.getOne.mockResolvedValue({
        id: 't1',
        userId: 'u1',
        usedAt: null,
        expiresAt: new Date(Date.now() - 60000), // expired
      });

      await expect(service.verifyEmail(rawToken)).rejects.toThrow(
        'Doğrulama bağlantısının süresi dolmuş',
      );
    });

    it('should verify email and mark token used on success', async () => {
      const qb = mockTokenRepoInTx.createQueryBuilder();
      qb.getOne.mockResolvedValue({
        id: 't1',
        userId: 'u1',
        usedAt: null,
        expiresAt: new Date(Date.now() + 600000),
      });

      mockUserRepoInTx.findOne.mockResolvedValue({ id: 'u1' });

      const result = await service.verifyEmail(rawToken);

      expect(result.message).toBe('E-posta başarıyla doğrulandı');

      // User should be marked verified
      expect(mockUserRepoInTx.update).toHaveBeenCalledWith('u1', { isVerified: true });

      // Token should be marked used
      expect(mockTokenRepoInTx.update).toHaveBeenCalledWith('t1', expect.objectContaining({
        usedAt: expect.any(Date),
      }));
    });
  });
});
