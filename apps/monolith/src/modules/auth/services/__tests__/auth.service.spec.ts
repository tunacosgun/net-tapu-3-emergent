import { Test, TestingModule } from '@nestjs/testing';
import { getRepositoryToken } from '@nestjs/typeorm';
import { UnauthorizedException } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { JwtService } from '@nestjs/jwt';
import * as bcrypt from 'bcrypt';
import { AuthService } from '../../auth.service';
import { User } from '../../entities/user.entity';
import { RefreshToken } from '../../entities/refresh-token.entity';
import { UserRole } from '../../entities/user-role.entity';
import { Role } from '../../entities/role.entity';
import { LoginAttempt } from '../../entities/login-attempt.entity';

describe('AuthService', () => {
  let service: AuthService;

  const mockUserRepo = {
    findOne: jest.fn(),
    update: jest.fn(),
    create: jest.fn().mockImplementation((v) => v),
    save: jest.fn(),
  };

  const mockRefreshTokenRepo = {
    findOne: jest.fn(),
    save: jest.fn(),
    create: jest.fn().mockImplementation((v) => v),
    update: jest.fn(),
  };

  const mockUserRoleRepo = {
    find: jest.fn().mockResolvedValue([]),
    save: jest.fn(),
    create: jest.fn().mockImplementation((v) => v),
  };

  const mockRoleRepo = {
    findOne: jest.fn(),
  };

  const mockLoginAttemptRepo = {
    save: jest.fn(),
    create: jest.fn().mockImplementation((v) => v),
  };

  const mockJwtService = {
    sign: jest.fn().mockReturnValue('mock.jwt.token'),
  };

  const mockConfig = {
    get: jest.fn().mockImplementation((key: string, def?: unknown) => {
      const map: Record<string, unknown> = {
        JWT_REFRESH_EXPIRATION_DAYS: 7,
        JWT_ACCESS_EXPIRATION: '15m',
      };
      return map[key] ?? def;
    }),
  };

  beforeEach(async () => {
    jest.clearAllMocks();

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        AuthService,
        { provide: getRepositoryToken(User), useValue: mockUserRepo },
        { provide: getRepositoryToken(RefreshToken), useValue: mockRefreshTokenRepo },
        { provide: getRepositoryToken(UserRole), useValue: mockUserRoleRepo },
        { provide: getRepositoryToken(Role), useValue: mockRoleRepo },
        { provide: getRepositoryToken(LoginAttempt), useValue: mockLoginAttemptRepo },
        { provide: JwtService, useValue: mockJwtService },
        { provide: ConfigService, useValue: mockConfig },
      ],
    }).compile();

    service = module.get<AuthService>(AuthService);
  });

  describe('changePassword', () => {
    const userId = 'user-123';
    const currentPassword = 'OldPassword1!';
    const newPassword = 'NewPassword1!';
    let hashedCurrent: string;

    beforeEach(async () => {
      hashedCurrent = await bcrypt.hash(currentPassword, 10);
    });

    it('should throw UnauthorizedException when current password is wrong', async () => {
      mockUserRepo.findOne.mockResolvedValue({
        id: userId,
        passwordHash: hashedCurrent,
      });

      await expect(
        service.changePassword(userId, 'WrongPassword!', newPassword),
      ).rejects.toThrow(UnauthorizedException);

      // Should NOT update password
      expect(mockUserRepo.update).not.toHaveBeenCalled();
    });

    it('should update password and revoke all refresh tokens on success', async () => {
      mockUserRepo.findOne.mockResolvedValue({
        id: userId,
        passwordHash: hashedCurrent,
      });

      await service.changePassword(userId, currentPassword, newPassword);

      // Password should be updated with new hash
      expect(mockUserRepo.update).toHaveBeenCalledWith(
        userId,
        expect.objectContaining({ passwordHash: expect.any(String) }),
      );

      // Verify new hash is different from old
      const updateCall = mockUserRepo.update.mock.calls[0];
      const newHash = updateCall[1].passwordHash;
      expect(newHash).not.toBe(hashedCurrent);

      // All refresh tokens should be revoked
      expect(mockRefreshTokenRepo.update).toHaveBeenCalledWith(
        expect.objectContaining({ userId }),
        expect.objectContaining({ revokedAt: expect.any(Date) }),
      );
    });

    it('should not update anything if user not found', async () => {
      mockUserRepo.findOne.mockResolvedValue(null);

      await expect(
        service.changePassword(userId, currentPassword, newPassword),
      ).rejects.toThrow('Kullanıcı bulunamadı');

      expect(mockUserRepo.update).not.toHaveBeenCalled();
      expect(mockRefreshTokenRepo.update).not.toHaveBeenCalled();
    });
  });
});
