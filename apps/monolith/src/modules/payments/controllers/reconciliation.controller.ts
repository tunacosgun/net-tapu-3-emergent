import { Controller, Get, Post, Query, HttpCode, HttpStatus, UseGuards, Logger } from '@nestjs/common';
import { Throttle } from '@nestjs/throttler';
import { JwtAuthGuard } from '../../auth/guards/jwt-auth.guard';
import { RolesGuard } from '../../auth/guards/roles.guard';
import { Roles } from '../../auth/decorators/roles.decorator';
import { ReconciliationService } from '../services/reconciliation.service';
import { ReconciliationWorker } from '../services/reconciliation.worker';
import { ReconciliationQueryDto } from '../dto/reconciliation-query.dto';

@Controller('admin/reconciliation')
@UseGuards(JwtAuthGuard, RolesGuard)
@Roles('admin')
export class ReconciliationController {
  private readonly logger = new Logger(ReconciliationController.name);

  constructor(
    private readonly reconciliationService: ReconciliationService,
    private readonly reconciliationWorker: ReconciliationWorker,
  ) {}

  @Get()
  async getReport(@Query() query: ReconciliationQueryDto) {
    return this.reconciliationService.getReconciliationReport(query);
  }

  @Post('trigger')
  @HttpCode(HttpStatus.OK)
  @Throttle({ short: { ttl: 60000, limit: 2 } })
  async triggerReconciliation() {
    this.logger.log(JSON.stringify({ event: 'reconciliation_manual_trigger' }));
    await this.reconciliationWorker.tick();
    return { triggered: true };
  }
}
