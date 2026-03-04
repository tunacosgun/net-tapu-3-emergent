import { Injectable, Logger, OnModuleDestroy, OnModuleInit } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import Redis from 'ioredis';

const KEY_PREFIX = 'parcel:viewers:';
const SESSION_PREFIX = 'parcel:session:';
const SESSION_TTL = 120; // 2 minutes — heartbeat must renew before expiry

@Injectable()
export class ViewerCountService implements OnModuleInit, OnModuleDestroy {
  private readonly logger = new Logger(ViewerCountService.name);
  private redis!: Redis;
  private connected = false;

  constructor(private readonly config: ConfigService) {}

  async onModuleInit() {
    const url = this.config.get<string>('REDIS_URL')!;
    this.redis = new Redis(url, {
      maxRetriesPerRequest: 1,
      connectTimeout: 3000,
      commandTimeout: 2000,
      lazyConnect: false,
      enableOfflineQueue: false,
    });

    this.redis.on('connect', () => {
      this.connected = true;
      this.logger.log('Redis connected for viewer tracking');
    });

    this.redis.on('error', (err) => {
      this.connected = false;
      this.logger.warn(`Redis viewer tracking error: ${err.message}`);
    });
  }

  async onModuleDestroy() {
    if (this.redis) {
      await this.redis.quit().catch(() => {});
    }
  }

  /**
   * Register a viewer for a parcel. Returns current viewer count.
   * Uses a session key (parcelId + sessionId) with TTL to auto-expire stale sessions.
   * The parcel viewer set key stores active session IDs.
   */
  async registerViewer(parcelId: string, sessionId: string): Promise<number> {
    if (!this.connected) return 0;

    try {
      const sessionKey = `${SESSION_PREFIX}${parcelId}:${sessionId}`;
      const viewerSetKey = `${KEY_PREFIX}${parcelId}`;

      // Use pipeline for atomic operations
      const pipeline = this.redis.pipeline();

      // Set session key with TTL (heartbeat refreshes this)
      pipeline.setex(sessionKey, SESSION_TTL, '1');

      // Add session to the parcel's viewer set
      pipeline.sadd(viewerSetKey, sessionId);

      // Keep the set alive as long as there are viewers
      pipeline.expire(viewerSetKey, SESSION_TTL * 2);

      await pipeline.exec();

      // Clean up expired sessions and return count
      return this.getActiveViewerCount(parcelId);
    } catch (err) {
      this.logger.warn(`Failed to register viewer: ${(err as Error).message}`);
      return 0;
    }
  }

  /**
   * Remove a viewer when they leave the page.
   */
  async removeViewer(parcelId: string, sessionId: string): Promise<number> {
    if (!this.connected) return 0;

    try {
      const sessionKey = `${SESSION_PREFIX}${parcelId}:${sessionId}`;
      const viewerSetKey = `${KEY_PREFIX}${parcelId}`;

      const pipeline = this.redis.pipeline();
      pipeline.del(sessionKey);
      pipeline.srem(viewerSetKey, sessionId);
      await pipeline.exec();

      return this.getActiveViewerCount(parcelId);
    } catch (err) {
      this.logger.warn(`Failed to remove viewer: ${(err as Error).message}`);
      return 0;
    }
  }

  /**
   * Get current active viewer count for a parcel.
   * Cleans up expired sessions before counting.
   */
  async getActiveViewerCount(parcelId: string): Promise<number> {
    if (!this.connected) return 0;

    try {
      const viewerSetKey = `${KEY_PREFIX}${parcelId}`;
      const sessionIds = await this.redis.smembers(viewerSetKey);

      if (sessionIds.length === 0) return 0;

      // Check which sessions are still active
      const pipeline = this.redis.pipeline();
      for (const sid of sessionIds) {
        pipeline.exists(`${SESSION_PREFIX}${parcelId}:${sid}`);
      }
      const results = await pipeline.exec();

      // Remove expired sessions
      const expiredSessions: string[] = [];
      let activeCount = 0;

      results?.forEach(([err, exists], idx) => {
        if (!err && exists === 0) {
          expiredSessions.push(sessionIds[idx]);
        } else if (!err && exists === 1) {
          activeCount++;
        }
      });

      // Clean up expired sessions from the set
      if (expiredSessions.length > 0) {
        await this.redis.srem(viewerSetKey, ...expiredSessions);
      }

      return activeCount;
    } catch (err) {
      this.logger.warn(`Failed to get viewer count: ${(err as Error).message}`);
      return 0;
    }
  }

  /**
   * Heartbeat — renew session TTL to keep the viewer counted.
   */
  async heartbeat(parcelId: string, sessionId: string): Promise<number> {
    if (!this.connected) return 0;

    try {
      const sessionKey = `${SESSION_PREFIX}${parcelId}:${sessionId}`;
      const viewerSetKey = `${KEY_PREFIX}${parcelId}`;

      const pipeline = this.redis.pipeline();
      pipeline.setex(sessionKey, SESSION_TTL, '1');
      pipeline.sadd(viewerSetKey, sessionId);
      pipeline.expire(viewerSetKey, SESSION_TTL * 2);
      await pipeline.exec();

      return this.getActiveViewerCount(parcelId);
    } catch (err) {
      this.logger.warn(`Heartbeat failed: ${(err as Error).message}`);
      return 0;
    }
  }
}
