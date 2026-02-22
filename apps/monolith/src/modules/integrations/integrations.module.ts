import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { TkgmCache } from './entities/tkgm-cache.entity';
import { SyncState } from './entities/sync-state.entity';
import { ExternalApiLog } from './entities/external-api-log.entity';

import { TkgmService } from './services/tkgm.service';
import { SyncStateService } from './services/sync-state.service';
import { ExternalApiLogService } from './services/external-api-log.service';

import { TkgmController } from './controllers/tkgm.controller';
import { SyncStateController } from './controllers/sync-state.controller';

@Module({
  imports: [
    TypeOrmModule.forFeature([
      TkgmCache,
      SyncState,
      ExternalApiLog,
    ]),
  ],
  controllers: [TkgmController, SyncStateController],
  providers: [TkgmService, SyncStateService, ExternalApiLogService],
  exports: [TypeOrmModule, TkgmService, ExternalApiLogService],
})
export class IntegrationsModule {}
