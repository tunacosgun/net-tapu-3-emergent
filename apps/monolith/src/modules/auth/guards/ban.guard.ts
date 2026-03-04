import {
  Injectable,
  CanActivate,
  ExecutionContext,
  ForbiddenException,
} from '@nestjs/common';
import { BanService } from '../services/ban.service';

@Injectable()
export class BanGuard implements CanActivate {
  constructor(private readonly banService: BanService) {}

  async canActivate(context: ExecutionContext): Promise<boolean> {
    const request = context.switchToHttp().getRequest();
    const ipAddress =
      (request.headers['x-forwarded-for'] as string)?.split(',')[0]?.trim() ??
      request.ip;
    const userId = request.user?.sub;

    const banReason = await this.banService.checkBan(ipAddress, userId);

    if (banReason) {
      throw new ForbiddenException(
        `Hesabınız veya IP adresiniz engellenmiştir: ${banReason}`,
      );
    }

    return true;
  }
}
