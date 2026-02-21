import { Controller, Get, Query, UseGuards } from '@nestjs/common';
import { JwtAuthGuard } from '../../auth/guards/jwt-auth.guard';
import { RolesGuard } from '../../auth/guards/roles.guard';
import { Roles } from '../../auth/decorators/roles.decorator';
import { ReconciliationService } from '../services/reconciliation.service';
import { ReconciliationQueryDto } from '../dto/reconciliation-query.dto';

@Controller('admin/reconciliation')
@UseGuards(JwtAuthGuard, RolesGuard)
@Roles('admin')
export class ReconciliationController {
  constructor(private readonly reconciliationService: ReconciliationService) {}

  @Get()
  async getReport(@Query() query: ReconciliationQueryDto) {
    return this.reconciliationService.getReconciliationReport(query);
  }
}
