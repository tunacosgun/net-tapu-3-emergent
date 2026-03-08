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

    const tokenData: GoogleTokenResponse = await tokenRes.json();

    // 2. Get user info
    const userInfoRes = await fetch('https://www.googleapis.com/oauth2/v3/userinfo', {
      headers: { Authorization: `Bearer ${tokenData.access_token}` },
    });

    if (!userInfoRes.ok) {
      throw new UnauthorizedException('Failed to get Google user info');
    }

    const googleUser: GoogleUserInfo = await userInfoRes.json();

    if (!googleUser.email || !googleUser.email_verified) {
      throw new UnauthorizedException('Google account email not verified');
    }

    // 3. Find or create user
    let user = await this.userRepo.findOne({ where: { googleId: googleUser.sub } });

    if (!user) {
      // Check if user exists with same email
      user = await this.userRepo.findOne({ where: { email: googleUser.email } });

      if (user) {
        // Link Google to existing account
        user.googleId = googleUser.sub;
        if (!user.avatarUrl && googleUser.picture) {
          user.avatarUrl = googleUser.picture;
        }
        if (!user.isVerified) {
          user.isVerified = true;
        }
        await this.userRepo.save(user);
      } else {
        // Create new user (no password needed for OAuth users)
        const randomPass = crypto.randomBytes(32).toString('hex');
        user = this.userRepo.create({
          email: googleUser.email,
          passwordHash: randomPass, // not usable for login
          firstName: googleUser.given_name || googleUser.name || 'User',
          lastName: googleUser.family_name || '',
          googleId: googleUser.sub,
          avatarUrl: googleUser.picture || null,
          isVerified: true,
        });
        await this.userRepo.save(user);

        // Assign default 'user' role
        const userRole = await this.roleRepo.findOne({ where: { name: 'user' } });
        if (userRole) {
          await this.userRoleRepo.save(
            this.userRoleRepo.create({ userId: user.id, roleId: userRole.id }),
          );
        }
      }
    } else {
      // Update avatar if changed
      if (googleUser.picture && user.avatarUrl !== googleUser.picture) {
        user.avatarUrl = googleUser.picture;
        await this.userRepo.save(user);
      }
    }

    if (!user.isActive) {
      throw new UnauthorizedException('Account is deactivated');
    }

    // 4. Update last login
    await this.userRepo.update(user.id, { lastLoginAt: new Date() });

    // 5. Issue JWT tokens
    const roles = await this.authService.getUserRolesPublic(user.id);
    return this.authService.issueTokensForOAuth(user, roles, deviceInfo, ipAddress);
  }
}
