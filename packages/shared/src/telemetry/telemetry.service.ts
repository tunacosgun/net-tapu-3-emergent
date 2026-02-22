import { Injectable } from '@nestjs/common';
import { DataSource } from 'typeorm';
import { monitorEventLoopDelay, IntervalHistogram } from 'perf_hooks';

@Injectable()
export class TelemetryService {
  private eld: IntervalHistogram;
  private prevCpu = process.cpuUsage();
  private prevTime = process.hrtime.bigint();

  constructor(private readonly dataSource: DataSource) {
    this.eld = monitorEventLoopDelay({ resolution: 20 });
    this.eld.enable();
  }

  getPoolStats(): {
    totalConnections: number;
    idleConnections: number;
    waitingClients: number;
  } {
    // TypeORM wraps node-postgres Pool. Access it via the driver.
    const driver = (this.dataSource as any).driver;
    const pool = driver?.master ?? driver?.pool;

    if (!pool) {
      return { totalConnections: -1, idleConnections: -1, waitingClients: -1 };
    }

    return {
      totalConnections: pool.totalCount ?? 0,
      idleConnections: pool.idleCount ?? 0,
      waitingClients: pool.waitingCount ?? 0,
    };
  }

  getRuntimeMetrics(): {
    eventLoopLagMs: number;
    heapUsedMB: number;
    cpuUsagePercent: number;
    rss: number;
  } {
    // Event loop lag (p99 in ms)
    const lagNs = this.eld.percentile(99);
    const eventLoopLagMs = Math.round((lagNs / 1e6) * 100) / 100;

    // Heap
    const mem = process.memoryUsage();
    const heapUsedMB = Math.round((mem.heapUsed / 1024 / 1024) * 100) / 100;
    const rss = Math.round((mem.rss / 1024 / 1024) * 100) / 100;

    // CPU — delta since last call
    const now = process.hrtime.bigint();
    const cpuNow = process.cpuUsage();
    const elapsedUs = Number(now - this.prevTime) / 1000; // ns → µs
    const userUs = cpuNow.user - this.prevCpu.user;
    const sysUs = cpuNow.system - this.prevCpu.system;
    const cpuUsagePercent =
      elapsedUs > 0
        ? Math.round(((userUs + sysUs) / elapsedUs) * 100 * 100) / 100
        : 0;

    this.prevCpu = cpuNow;
    this.prevTime = now;

    // Reset ELD to get fresh samples for next interval
    this.eld.reset();

    return { eventLoopLagMs, heapUsedMB, cpuUsagePercent, rss };
  }
}
