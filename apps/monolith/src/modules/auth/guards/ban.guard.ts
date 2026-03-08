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

    const ban = await this.banService.checkBan(ipAddress, userId);

    if (ban) {
      const expiresText = ban.expiresAt
        ? `Bu engel ${new Date(ban.expiresAt).toLocaleDateString('tr-TR', { day: '2-digit', month: '2-digit', year: 'numeric', hour: '2-digit', minute: '2-digit' })} tarihine kadar geçerlidir.`
        : 'Bu engel süresizdir.';

      if (ban.type === 'ip') {
        throw new ForbiddenException(
          `Bu cihazdan erişiminiz engellenmiştir. Sebep: ${ban.reason}. ${expiresText}`,
        );
      } else {
        throw new ForbiddenException(
          `Hesabınız engellenmiştir. Sebep: ${ban.reason}. ${expiresText}`,
        );
      }
    }

    return true;
  }
}
