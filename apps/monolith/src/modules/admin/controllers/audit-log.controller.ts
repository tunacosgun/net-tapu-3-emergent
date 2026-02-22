import {
  Controller,
  Get,
  Query,
  UseGuards,
} from '@nestjs/common';
import { JwtAuthGuard } from '../../auth/guards/jwt-auth.guard';
import { RolesGuard } from '../../auth/guards/roles.guard';
import { Roles } from '../../auth/decorators/roles.decorator';
import { AuditLogService } from '../services/audit-log.service';
import { ListAuditLogQueryDto } from '../dto/list-audit-log-query.dto';

@Controller('admin/audit-log')
@UseGuards(JwtAuthGuard, RolesGuard)
@Roles('admin')
export class AuditLogController {
  constructor(private readonly auditLogService: AuditLogService) {}

  @Get()
  async findAll(@Query() query: ListAuditLogQueryDto) {
    return this.auditLogService.findAll(query);
  }
}
