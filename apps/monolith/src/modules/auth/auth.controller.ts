import {
  Controller,
  Post,
  Get,
  Patch,
  Body,
  Req,
  Res,
  Query,
  HttpCode,
  HttpStatus,
  UseGuards,
} from '@nestjs/common';
import { Throttle } from '@nestjs/throttler';
import { Request, Response } from 'express';
import { AuthService } from './auth.service';
import { PasswordResetService } from './services/password-reset.service';
import { EmailVerificationService } from './services/email-verification.service';
import { BanService } from './services/ban.service';
import { GoogleOAuthService } from './services/google-oauth.service';
import { JwtAuthGuard } from './guards/jwt-auth.guard';
import { CurrentUser } from './decorators/current-user.decorator';
import { JwtPayload } from './auth.service';
import { RegisterDto } from './dto/register.dto';
import { LoginDto } from './dto/login.dto';
import { RefreshDto } from './dto/refresh.dto';
import { ForgotPasswordDto } from './dto/forgot-password.dto';
import { ResetPasswordDto } from './dto/reset-password.dto';
import { VerifyEmailDto } from './dto/verify-email.dto';
import { UpdateProfileDto } from './dto/update-profile.dto';
import { ChangePasswordDto } from './dto/change-password.dto';

@Controller('auth')
export class AuthController {
  constructor(
    private readonly authService: AuthService,
    private readonly passwordResetService: PasswordResetService,
    private readonly emailVerificationService: EmailVerificationService,
    private readonly banService: BanService,
    private readonly googleOAuthService: GoogleOAuthService,
  ) {}

  @Post('register')
  @Throttle({ short: { ttl: 60000, limit: 5 } })
  @HttpCode(HttpStatus.CREATED)
  async register(@Body() dto: RegisterDto) {
    return this.authService.register(dto);
  }

  @Post('login')
  @Throttle({ short: { ttl: 60000, limit: 10 } })
  @HttpCode(HttpStatus.OK)
  async login(@Body() dto: LoginDto, @Req() req: Request) {
    const deviceInfo = req.headers['user-agent'] ?? undefined;
    const ipAddress =
      (req.headers['x-forwarded-for'] as string)?.split(',')[0]?.trim() ??
      req.ip;
    return this.authService.login(
      dto.email,
      dto.password,
      deviceInfo,
      ipAddress,
    );
  }

  @Post('refresh')
  @Throttle({ short: { ttl: 60000, limit: 15 } })
  @HttpCode(HttpStatus.OK)
  async refresh(@Body() dto: RefreshDto, @Req() req: Request) {
    const deviceInfo = req.headers['user-agent'] ?? undefined;
    const ipAddress =
      (req.headers['x-forwarded-for'] as string)?.split(',')[0]?.trim() ??
      req.ip;
    return this.authService.refresh(dto.refreshToken, deviceInfo, ipAddress);
  }

  @Post('logout')
  @HttpCode(HttpStatus.NO_CONTENT)
  async logout(@Body() dto: RefreshDto) {
    await this.authService.logout(dto.refreshToken);
  }

  @Post('logout-all')
  @UseGuards(JwtAuthGuard)
  @HttpCode(HttpStatus.NO_CONTENT)
  async logoutAll(@CurrentUser() user: JwtPayload) {
    await this.authService.logoutAll(user.sub);
  }

  // ── Password Reset ──────────────────────────────────────────

  @Post('forgot-password')
  @Throttle({ short: { ttl: 60000, limit: 3 } })
  @HttpCode(HttpStatus.OK)
  async forgotPassword(@Body() dto: ForgotPasswordDto) {
    await this.passwordResetService.requestReset(dto.email);
    return { message: 'Sıfırlama bağlantısı e-posta adresinize gönderildi' };
  }

  @Post('reset-password')
  @Throttle({ short: { ttl: 60000, limit: 5 } })
  @HttpCode(HttpStatus.OK)
  async resetPassword(@Body() dto: ResetPasswordDto) {
    await this.passwordResetService.resetPassword(dto.token, dto.newPassword);
    return { message: 'Şifreniz başarıyla güncellendi' };
  }

  // ── Email Verification ──────────────────────────────────────

  @Post('send-verification')
  @UseGuards(JwtAuthGuard)
  @Throttle({ short: { ttl: 60000, limit: 3 } })
  @HttpCode(HttpStatus.OK)
  async sendVerification(@CurrentUser() user: JwtPayload) {
    await this.emailVerificationService.sendVerification(user.sub);
    return { message: 'Doğrulama e-postası gönderildi' };
  }

  @Post('verify-email')
  @Throttle({ short: { ttl: 60000, limit: 5 } })
  @HttpCode(HttpStatus.OK)
  async verifyEmail(@Body() dto: VerifyEmailDto) {
    return this.emailVerificationService.verifyEmail(dto.token);
  }

  // ── Profile ─────────────────────────────────────────────────

  @Get('me')
  @UseGuards(JwtAuthGuard)
  async getProfile(@CurrentUser() user: JwtPayload) {
    return this.authService.getProfile(user.sub);
  }

  @Patch('profile')
  @UseGuards(JwtAuthGuard)
  @HttpCode(HttpStatus.OK)
  async updateProfile(
    @CurrentUser() user: JwtPayload,
    @Body() dto: UpdateProfileDto,
  ) {
    return this.authService.updateProfile(user.sub, dto);
  }

  @Post('change-password')
  @UseGuards(JwtAuthGuard)
  @Throttle({ short: { ttl: 60000, limit: 3 } })
  @HttpCode(HttpStatus.OK)
  async changePassword(
    @CurrentUser() user: JwtPayload,
    @Body() dto: ChangePasswordDto,
  ) {
    await this.authService.changePassword(
      user.sub,
      dto.currentPassword,
      dto.newPassword,
    );
    return { message: 'Şifreniz başarıyla değiştirildi' };
  }

  // ── Notification Preferences ─────────────────────────────────

  @Get('notification-preferences')
  @UseGuards(JwtAuthGuard)
  async getNotificationPreferences(@CurrentUser() user: JwtPayload) {
    return this.authService.getNotificationPreferences(user.sub);
  }

  @Patch('notification-preferences')
  @UseGuards(JwtAuthGuard)
  @HttpCode(HttpStatus.OK)
  async updateNotificationPreferences(
    @CurrentUser() user: JwtPayload,
    @Body() body: Record<string, { email: boolean; sms: boolean; push: boolean }>,
  ) {
    return this.authService.updateNotificationPreferences(user.sub, body);
  }

  // ── Ban Status ─────────────────────────────────────────────

  @Get('ban-status')
  @UseGuards(JwtAuthGuard)
  async getBanStatus(@CurrentUser() user: JwtPayload, @Req() req: Request) {
    const ipAddress =
      (req.headers['x-forwarded-for'] as string)?.split(',')[0]?.trim() ??
      req.ip;
    return this.banService.getUserBanStatus(ipAddress, user.sub);
  }

  // ── Google OAuth ──────────────────────────────────────────────

  @Get('google')
  async googleAuth(@Res() res: Response, @Query('returnTo') returnTo?: string) {
    const state = returnTo ? Buffer.from(returnTo).toString('base64') : '';
    const url = this.googleOAuthService.getAuthUrl(state);
    res.redirect(url);
  }

  @Get('google/callback')
  async googleCallback(
    @Query('code') code: string,
    @Query('state') state: string,
    @Req() req: Request,
    @Res() res: Response,
  ) {
    try {
      const deviceInfo = req.headers['user-agent'] ?? undefined;
      const ipAddress =
        (req.headers['x-forwarded-for'] as string)?.split(',')[0]?.trim() ??
        req.ip;

      const result = await this.googleOAuthService.handleCallback(
        code,
        deviceInfo,
        ipAddress,
      );

      const returnTo = state
        ? Buffer.from(state, 'base64').toString('utf-8')
        : '/';

      // Redirect to frontend with tokens as query params (short-lived)
      const frontendUrl = process.env.FRONTEND_URL || 'https://nettapu-demo.tunasoft.tech';
      const params = new URLSearchParams({
        accessToken: result.accessToken,
        refreshToken: result.refreshToken,
        returnTo,
      });
      res.redirect(`${frontendUrl}/auth/social-callback?${params.toString()}`);
    } catch {
      const frontendUrl = process.env.FRONTEND_URL || 'https://nettapu-demo.tunasoft.tech';
      res.redirect(`${frontendUrl}/login?error=google_auth_failed`);
    }
  }
}
