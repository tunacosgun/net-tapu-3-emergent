import { Module } from '@nestjs/common';
import { HealthController } from './health.controller';
import { HealthService } from './health.service';
import { TelemetryService } from '@nettapu/shared';
import { InternalController } from './internal.controller';

@Module({
  controllers: [HealthController, InternalController],
  providers: [HealthService, TelemetryService],
})
export class HealthModule {}
