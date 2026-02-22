import { Controller, Get } from '@nestjs/common';
import { SkipThrottle } from '@nestjs/throttler';
import { TelemetryService } from '@nettapu/shared';

@SkipThrottle()
@Controller('internal')
export class InternalController {
  constructor(private readonly telemetry: TelemetryService) {}

  @Get('pool-stats')
  getPoolStats() {
    return this.telemetry.getPoolStats();
  }

  @Get('runtime-metrics')
  getRuntimeMetrics() {
    return this.telemetry.getRuntimeMetrics();
  }
}
