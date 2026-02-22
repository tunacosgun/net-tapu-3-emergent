import cluster from 'node:cluster';
import { cpus } from 'node:os';

/**
 * Production-safe cluster bootstrap.
 *
 * Usage in main.ts:
 *   clusterize(bootstrap, { workers: 4 });
 *
 * Behavior:
 * - CLUSTER_WORKERS=0 or 1 → no clustering, runs bootstrap() directly
 * - CLUSTER_WORKERS=N → forks N workers, each runs bootstrap()
 * - Primary process does NOT run bootstrap() — it only manages workers
 * - Graceful shutdown: SIGTERM/SIGINT → signal all workers → wait → exit
 */

export interface ClusterOptions {
  /** Number of workers. Defaults to CLUSTER_WORKERS env or CPU count. */
  workers?: number;
  /** Service name for log prefix. */
  name?: string;
}

export function clusterize(
  bootstrap: () => Promise<void>,
  opts: ClusterOptions = {},
): void {
  const envWorkers = parseInt(process.env.CLUSTER_WORKERS || '0', 10);
  const workerCount = opts.workers ?? (envWorkers || cpus().length);

  const name = opts.name ?? 'app';

  // Single-process mode: skip clustering entirely
  if (workerCount <= 1) {
    bootstrap();
    return;
  }

  if (cluster.isPrimary) {
    runPrimary(workerCount, name);
  } else {
    bootstrap();
  }
}

function runPrimary(workerCount: number, name: string): void {
  console.log(
    JSON.stringify({
      level: 'info',
      context: `${name}:cluster:primary`,
      pid: process.pid,
      workers: workerCount,
      message: `Forking ${workerCount} workers`,
    }),
  );

  // Fork workers
  for (let i = 0; i < workerCount; i++) {
    cluster.fork();
  }

  // Replace crashed workers (unless shutting down)
  let shuttingDown = false;

  cluster.on('exit', (worker, code, signal) => {
    const msg = {
      level: shuttingDown ? 'info' : 'error',
      context: `${name}:cluster:primary`,
      pid: worker.process.pid,
      code,
      signal,
      message: shuttingDown
        ? `Worker ${worker.id} exited during shutdown`
        : `Worker ${worker.id} died (code=${code}, signal=${signal}), restarting...`,
    };
    console.log(JSON.stringify(msg));

    if (!shuttingDown) {
      cluster.fork();
    }
  });

  // Graceful shutdown: forward signal to all workers, wait, then exit
  const shutdown = (signal: string) => {
    if (shuttingDown) return;
    shuttingDown = true;

    console.log(
      JSON.stringify({
        level: 'info',
        context: `${name}:cluster:primary`,
        pid: process.pid,
        signal,
        message: `Received ${signal}, shutting down ${Object.keys(cluster.workers ?? {}).length} workers...`,
      }),
    );

    // Signal each worker
    for (const id in cluster.workers) {
      const w = cluster.workers[id];
      if (w) {
        w.process.kill(signal as NodeJS.Signals);
      }
    }

    // Force exit after 15s if workers haven't exited
    const forceTimer = setTimeout(() => {
      console.log(
        JSON.stringify({
          level: 'warn',
          context: `${name}:cluster:primary`,
          message: 'Force exiting after 15s timeout',
        }),
      );
      process.exit(1);
    }, 15_000);
    forceTimer.unref();

    // Wait for all workers to exit
    const checkAllExited = setInterval(() => {
      const alive = Object.values(cluster.workers ?? {}).filter(
        (w) => w && !w.isDead(),
      );
      if (alive.length === 0) {
        clearInterval(checkAllExited);
        clearTimeout(forceTimer);
        console.log(
          JSON.stringify({
            level: 'info',
            context: `${name}:cluster:primary`,
            message: 'All workers exited cleanly',
          }),
        );
        process.exit(0);
      }
    }, 200);
  };

  process.on('SIGTERM', () => shutdown('SIGTERM'));
  process.on('SIGINT', () => shutdown('SIGINT'));
}
