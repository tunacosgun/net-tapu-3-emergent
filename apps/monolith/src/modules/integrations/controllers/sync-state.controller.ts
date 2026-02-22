import {
  Controller,
  Get,
  Query,
  UseGuards,
} from '@nestjs/common';
import { JwtAuthGuard } from '../../auth/guards/jwt-auth.guard';
import { RolesGuard } from '../../auth/guards/roles.guard';
import { Roles } from '../../auth/decorators/roles.decorator';
import { SyncStateService } from '../services/sync-state.service';
import { ListSyncStateQueryDto } from '../dto/list-sync-state-query.dto';

@Controller('integrations/sync-state')
@UseGuards(JwtAuthGuard, RolesGuard)
@Roles('admin')
export class SyncStateController {
  constructor(private readonly syncStateService: SyncStateService) {}

  @Get()
  async findAll(@Query() query: ListSyncStateQueryDto) {
    return this.syncStateService.findAll(query);
  }
}
