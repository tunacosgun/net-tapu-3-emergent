import { Controller, Get, Res } from '@nestjs/common';
import { SkipThrottle } from '@nestjs/throttler';
import { Response } from 'express';
import { Registry, collectDefaultMetrics } from 'prom-client';

const registry = new Registry();
const workerId = process.env.CLUSTER_WORKER_ID || '0';
registry.setDefaultLabels({ app: 'monolith', worker: workerId });
collectDefaultMetrics({ register: registry });

@SkipThrottle()
@Controller('metrics')
export class MetricsController {
  @Get()
  async getMetrics(@Res() res: Response): Promise<void> {
    res.set('Content-Type', registry.contentType);
    res.end(await registry.metrics());
  }
}
