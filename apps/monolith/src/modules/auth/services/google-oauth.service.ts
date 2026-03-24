import { Injectable, Logger, UnauthorizedException } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { User } from '../entities/user.entity';
import { Role } from '../entities/role.entity';
import { UserRole } from '../entities/user-role.entity';
import { AuthService } from '../auth.service';
import * as crypto from 'crypto';

interface GoogleTokenResponse {
  access_token: string;
  id_token: string;
  token_type: string;
}

interface GoogleUserInfo {
  sub: string;        // Google user ID
  email: string;
  email_verified: boolean;
  name: string;
  given_name: string;
  family_name: string;
  picture?: string;
}

@Injectable()
export class GoogleOAuthService {
  private readonly logger = new Logger(GoogleOAuthService.name);
  private readonly clientId: string;
  private readonly clientSecret: string;
  private readonly redirectUri: string;

  constructor(
    private readonly config: ConfigService,
    @InjectRepository(User) private readonly userRepo: Repository<User>,
    @InjectRepository(Role) private readonly roleRepo: Repository<Role>,
    @InjectRepository(UserRole) private readonly userRoleRepo: Repository<UserRole>,
    private readonly authService: AuthService,
  ) {
    this.clientId = this.config.get<string>('GOOGLE_CLIENT_ID', '');
    this.clientSecret = this.config.get<string>('GOOGLE_CLIENT_SECRET', '');
    this.redirectUri = this.config.get<string>(
      'GOOGLE_REDIRECT_URI',
      'https://nettapu-demo.tunasoft.tech/api/v1/auth/google/callback',
    );
  }

  /** Build the Google OAuth consent URL */
  getAuthUrl(state?: string): string {
    const params = new URLSearchParams({
      client_id: this.clientId,
      redirect_uri: this.redirectUri,
      response_type: 'code',
      scope: 'openid email profile',
      access_type: 'offline',
      prompt: 'select_account',
      ...(state && { state }),
    });
    return `https://accounts.google.com/o/oauth2/v2/auth?${params.toString()}`;
  }

  /** Verify Google One Tap credential (ID token) and find-or-create user */
  async handleOneTapCredential(credential: string, deviceInfo?: string, ipAddress?: string) {
    // Verify the ID token with Google
    const verifyRes = await fetch(
      `https://oauth2.googleapis.com/tokeninfo?id_token=${encodeURIComponent(credential)}`,
    );

    if (!verifyRes.ok) {
      this.logger.error('Google One Tap token verification failed');
      throw new UnauthorizedException('Invalid Google credential');
    }

    const payload = (await verifyRes.json()) as {
      aud: string;
      sub: string;
      email: string;
      email_verified: string;
      name?: string;
      given_name?: string;
      family_name?: string;
      picture?: string;
    };

    // Verify audience matches our client ID
    if (payload.aud !== this.clientId) {
      this.logger.error(`Google One Tap aud mismatch: ${payload.aud}`);
      throw new UnauthorizedException('Invalid Google credential');
    }

    if (!payload.email || payload.email_verified !== 'true') {
      throw new UnauthorizedException('Google account email not verified');
    }

    const googleUser: GoogleUserInfo = {
      sub: payload.sub,
      email: payload.email,
      email_verified: true,
      name: payload.name || '',
      given_name: payload.given_name || '',
      family_name: payload.family_name || '',
      picture: payload.picture,
    };

    return this.findOrCreateAndIssueTokens(googleUser, deviceInfo, ipAddress);
  }

  /** Exchange authorization code for tokens, then find-or-create user */
  async handleCallback(code: string, deviceInfo?: string, ipAddress?: string) {
    // 1. Exchange code for tokens
    const tokenRes = await fetch('https://oauth2.googleapis.com/token', {
      method: 'POST',
      headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
      body: new URLSearchParams({
        code,
        client_id: this.clientId,
        client_secret: this.clientSecret,
        redirect_uri: this.redirectUri,
        grant_type: 'authorization_code',
      }),
    });

    if (!tokenRes.ok) {
      const err = await tokenRes.text();
      this.logger.error(`Google token exchange failed: ${err}`);
      throw new UnauthorizedException('Google authentication failed');
    }

    const tokenData = (await tokenRes.json()) as GoogleTokenResponse;

    // 2. Get user info
    const userInfoRes = await fetch('https://www.googleapis.com/oauth2/v3/userinfo', {
      headers: { Authorization: `Bearer ${tokenData.access_token}` },
    });

    if (!userInfoRes.ok) {
      throw new UnauthorizedException('Failed to get Google user info');
    }

    const googleUser = (await userInfoRes.json()) as GoogleUserInfo;

    if (!googleUser.email || !googleUser.email_verified) {
      throw new UnauthorizedException('Google account email not verified');
    }

    return this.findOrCreateAndIssueTokens(googleUser, deviceInfo, ipAddress);
  }

  /** Shared: find or create user from Google info, then issue JWT tokens */
  private async findOrCreateAndIssueTokens(
    googleUser: GoogleUserInfo,
    deviceInfo?: string,
    ipAddress?: string,
  ) {
    let user = await this.userRepo.findOne({ where: { googleId: googleUser.sub } });

    if (!user) {
      user = await this.userRepo.findOne({ where: { email: googleUser.email } });

      if (user) {
        user.googleId = googleUser.sub;
        if (!user.avatarUrl && googleUser.picture) {
          user.avatarUrl = googleUser.picture;
        }
        if (!user.isVerified) {
          user.isVerified = true;
        }
        await this.userRepo.save(user);
      } else {
        const randomPass = crypto.randomBytes(32).toString('hex');
        const baseUsername = googleUser.email.split('@')[0].replace(/[^a-zA-Z0-9_]/g, '_').slice(0, 24);
        const suffix = crypto.randomBytes(3).toString('hex');
        const username = `${baseUsername}_${suffix}`;
        user = this.userRepo.create({
          email: googleUser.email,
          username,
          passwordHash: randomPass,
          firstName: googleUser.given_name || googleUser.name || 'User',
          lastName: googleUser.family_name || '',
          googleId: googleUser.sub,
          avatarUrl: googleUser.picture || null,
          isVerified: true,
        });
        await this.userRepo.save(user);

        const userRole = await this.roleRepo.findOne({ where: { name: 'user' } });
        if (userRole) {
          await this.userRoleRepo.save(
            this.userRoleRepo.create({ userId: user.id, roleId: userRole.id }),
          );
        }
      }
    } else {
      if (googleUser.picture && user.avatarUrl !== googleUser.picture) {
        user.avatarUrl = googleUser.picture;
        await this.userRepo.save(user);
      }
    }

    if (!user.isActive) {
      throw new UnauthorizedException('Account is deactivated');
    }

    await this.userRepo.update(user.id, { lastLoginAt: new Date() });

    const roles = await this.authService.getUserRolesPublic(user.id);
    return this.authService.issueTokensForOAuth(user, roles, deviceInfo, ipAddress);
  }
}
