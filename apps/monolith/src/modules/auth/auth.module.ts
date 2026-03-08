import { Module } from '@nestjs/common';
import { ConfigModule, ConfigService } from '@nestjs/config';
import { JwtModule, JwtModuleOptions } from '@nestjs/jwt';
import { PassportModule } from '@nestjs/passport';
import { TypeOrmModule } from '@nestjs/typeorm';
import { User } from './entities/user.entity';
import { Role } from './entities/role.entity';
import { UserRole } from './entities/user-role.entity';
import { RefreshToken } from './entities/refresh-token.entity';
import { Consent } from './entities/consent.entity';
import { DealerQuota } from './entities/dealer-quota.entity';
import { PasswordResetToken } from './entities/password-reset-token.entity';
import { EmailVerificationToken } from './entities/email-verification-token.entity';
import { IpBan } from './entities/ip-ban.entity';
import { LoginAttempt } from './entities/login-attempt.entity';
import { NotificationQueue } from '../crm/entities/notification-queue.entity';
import { AuthService } from './auth.service';
import { PasswordResetService } from './services/password-reset.service';
import { EmailVerificationService } from './services/email-verification.service';
import { BanService } from './services/ban.service';
import { AuthController } from './auth.controller';
import { BanController } from './controllers/ban.controller';
import { AdminUserController } from './controllers/admin-user.controller';
import { AdminUserService } from './services/admin-user.service';
import { GoogleOAuthService } from './services/google-oauth.service';
import { JwtStrategy } from './strategies/jwt.strategy';
import { RolesGuard } from './guards/roles.guard';
import { BanGuard } from './guards/ban.guard';

@Module({
  imports: [
    TypeOrmModule.forFeature([
      User,
      Role,
      UserRole,
      RefreshToken,
      Consent,
      DealerQuota,
      PasswordResetToken,
      EmailVerificationToken,
      IpBan,
      LoginAttempt,
      NotificationQueue,
    ]),
    PassportModule.register({ defaultStrategy: 'jwt' }),
    JwtModule.registerAsync({
      imports: [ConfigModule],
      inject: [ConfigService],
      useFactory: (config: ConfigService): JwtModuleOptions => {
        const expiresIn = config.get<string>('JWT_ACCESS_EXPIRATION', '15m');
        return {
          secret: config.getOrThrow<string>('JWT_SECRET'),
          signOptions: {
            expiresIn,
            algorithm: 'HS256',
            issuer: config.getOrThrow<string>('JWT_ISSUER'),
            audience: config.getOrThrow<string>('JWT_AUDIENCE'),
          } as JwtModuleOptions['signOptions'],
        };
      },
    }),
  ],
  controllers: [AuthController, BanController, AdminUserController],
  providers: [
    AuthService,
    PasswordResetService,
    EmailVerificationService,
    BanService,
    AdminUserService,
    GoogleOAuthService,
    JwtStrategy,
    RolesGuard,
    BanGuard,
  ],
  exports: [AuthService, BanService, JwtStrategy, RolesGuard, BanGuard, TypeOrmModule],
})
export class AuthModule {}
