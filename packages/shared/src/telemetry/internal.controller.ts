import { Controller, Get } from '@nestjs/common';
import { TelemetryService } from './telemetry.service';

@Controller('internal')
export class InternalTelemetryController {
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
