import {
  Controller,
  Get,
  Post,
  Patch,
  Delete,
  Param,
  Query,
  Body,
  UseGuards,
  ParseUUIDPipe,
  NotFoundException,
  HttpCode,
  HttpStatus,
} from '@nestjs/common';
import { JwtAuthGuard } from '../guards/jwt-auth.guard';
import { RolesGuard } from '../guards/roles.guard';
import { Roles } from '../decorators/roles.decorator';
import { CurrentUser } from '../decorators/current-user.decorator';
import { JwtPayload } from '../auth.service';
import { AdminUserService } from '../services/admin-user.service';

@Controller('admin/users')
@UseGuards(JwtAuthGuard, RolesGuard)
@Roles('admin', 'superadmin')
export class AdminUserController {
  constructor(private readonly adminUserService: AdminUserService) {}

  @Get()
  async listUsers(
    @Query('page') page?: string,
    @Query('limit') limit?: string,
    @Query('search') search?: string,
  ) {
    return this.adminUserService.listUsers(
      parseInt(page || '1', 10),
      parseInt(limit || '20', 10),
      search,
    );
  }

  @Get(':id')
  async getUserDetail(@Param('id', ParseUUIDPipe) id: string) {
    const user = await this.adminUserService.getUserDetail(id);
    if (!user) throw new NotFoundException('Kullanıcı bulunamadı');
    return user;
  }

  @Get(':id/sessions')
  async getUserSessions(@Param('id', ParseUUIDPipe) id: string) {
    return this.adminUserService.getUserSessions(id);
  }

  @Get(':id/login-history')
  async getUserLoginHistory(
    @Param('id', ParseUUIDPipe) id: string,
    @Query('page') page?: string,
    @Query('limit') limit?: string,
  ) {
    return this.adminUserService.getUserLoginHistory(
      id,
      parseInt(page || '1', 10),
      parseInt(limit || '50', 10),
    );
  }

  @Patch(':id/toggle-active')
  @HttpCode(HttpStatus.OK)
  async toggleUserActive(
    @Param('id', ParseUUIDPipe) id: string,
    @CurrentUser() admin: JwtPayload,
  ) {
    return this.adminUserService.toggleUserActive(id, admin.sub);
  }

  @Post(':id/reset-password')
  @HttpCode(HttpStatus.OK)
  async resetUserPassword(
    @Param('id', ParseUUIDPipe) id: string,
    @Body('newPassword') newPassword: string,
    @CurrentUser() admin: JwtPayload,
  ) {
    if (!newPassword || newPassword.length < 8) {
      throw new NotFoundException('Şifre en az 8 karakter olmalıdır');
    }
    await this.adminUserService.resetUserPassword(id, newPassword, admin.sub);
    return { message: 'Şifre başarıyla sıfırlandı' };
  }

  @Delete(':id')
  @HttpCode(HttpStatus.OK)
  async deleteUser(
    @Param('id', ParseUUIDPipe) id: string,
    @CurrentUser() admin: JwtPayload,
  ) {
    await this.adminUserService.deleteUser(id, admin.sub);
    return { message: 'Kullanıcı silindi' };
  }

  @Post(':id/revoke-sessions')
  @HttpCode(HttpStatus.OK)
  async revokeAllSessions(
    @Param('id', ParseUUIDPipe) id: string,
    @CurrentUser() admin: JwtPayload,
  ) {
    return this.adminUserService.revokeAllSessions(id, admin.sub);
  }
}
