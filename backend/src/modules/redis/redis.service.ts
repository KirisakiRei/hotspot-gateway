import { Injectable, Logger, OnModuleInit, OnModuleDestroy } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import Redis from 'ioredis';
import type { JsonValue } from '@/common/types/json';
import { getErrorMessage } from '@/common/utils/error';

type RedisMessageHandler = (data: JsonValue) => void;

@Injectable()
export class RedisService implements OnModuleInit, OnModuleDestroy {
  private readonly logger = new Logger(RedisService.name);
  
  private publisher: Redis | null = null;
  private subscriber: Redis | null = null;
  private isConnected = false;
  private useRedis = false;

  // Store subscription callbacks
  private subscriptions: Map<string, RedisMessageHandler[]> = new Map();

  constructor(private configService: ConfigService) {}

  async onModuleInit() {
    const redisHost = this.configService.get<string>('REDIS_HOST');
    const redisPort = this.configService.get<number | string>('REDIS_PORT') || 6379;
    
    // Only connect to Redis if REDIS_HOST is explicitly configured and not empty
    if (!redisHost || redisHost.trim() === '' || redisHost === 'disabled' || redisHost === 'false') {
      this.logger.log('Redis is disabled. Operating in local in-memory pub/sub mode.');
      this.useRedis = false;
      return;
    }

    this.useRedis = true;
    await this.connect();
  }

  async onModuleDestroy() {
    await this.disconnect();
  }

  private async connect(): Promise<boolean> {
    try {
      const host = this.configService.get('REDIS_HOST') || 'localhost';
      const port = parseInt(this.configService.get('REDIS_PORT') || '6379', 10);
      const password = this.configService.get('REDIS_PASSWORD') || undefined;

      this.logger.log(`Connecting to Redis server at ${host}:${port}`);

      // Create publisher connection
      this.publisher = new Redis({
        host,
        port,
        password,
        maxRetriesPerRequest: 3,
        retryStrategy: (times) => {
          if (times > 3) {
            this.logger.error('Redis connection attempt limit exceeded (3 retries)');
            return null;
          }
          return Math.min(times * 200, 2000);
        },
      });

      // Create subscriber connection (separate connection for pub/sub)
      this.subscriber = new Redis({
        host,
        port,
        password,
        maxRetriesPerRequest: 3,
        retryStrategy: (times) => {
          if (times > 3) {
            return null;
          }
          return Math.min(times * 200, 2000);
        },
      });

      // Setup error handlers
      this.publisher.on('error', (err) => {
        this.logger.error(`Redis publisher error: ${err.message}`);
        this.isConnected = false;
      });

      this.subscriber.on('error', (err) => {
        this.logger.error(`Redis subscriber error: ${err.message}`);
        this.isConnected = false;
      });

      // Handle incoming messages
      this.subscriber.on('message', (channel, message) => {
        try {
          const data = JSON.parse(message);
          const callbacks = this.subscriptions.get(channel) || [];
          callbacks.forEach(cb => cb(data));
        } catch (error) {
          this.logger.error(`Failed to parse Redis message payload: ${error}`);
        }
      });

      // Test connection
      await this.publisher.ping();
      this.isConnected = true;
      this.logger.log('Redis client connected successfully');
      
      return true;
    } catch (error: unknown) {
      this.logger.error(`Failed to establish Redis connection: ${getErrorMessage(error)}`);
      this.isConnected = false;
      this.useRedis = false;
      return false;
    }
  }

  private async disconnect(): Promise<void> {
    if (this.publisher) {
      await this.publisher.quit();
      this.publisher = null;
    }
    if (this.subscriber) {
      await this.subscriber.quit();
      this.subscriber = null;
    }
    this.isConnected = false;
    this.logger.log('Redis connection closed');
  }

  /**
   * Publish a message to a channel
   */
  async publish(channel: string, data: JsonValue): Promise<boolean> {
    if (!this.useRedis || !this.publisher || !this.isConnected) {
      // Fallback: emit locally if Redis not available
      const callbacks = this.subscriptions.get(channel) || [];
      callbacks.forEach(cb => cb(data));
      return true;
    }

    try {
      await this.publisher.publish(channel, JSON.stringify(data));
      return true;
    } catch (error: unknown) {
      this.logger.error(`Failed to publish to ${channel}: ${getErrorMessage(error)}`);
      return false;
    }
  }

  /**
   * Subscribe to a channel
   */
  async subscribe(channel: string, callback: RedisMessageHandler): Promise<boolean> {
    // Store callback locally (works with or without Redis)
    if (!this.subscriptions.has(channel)) {
      this.subscriptions.set(channel, []);
    }
    this.subscriptions.get(channel)!.push(callback);

    // Subscribe via Redis if available
    if (this.useRedis && this.subscriber && this.isConnected) {
      try {
        await this.subscriber.subscribe(channel);
        this.logger.debug(`Subscribed to Redis channel: ${channel}`);
      } catch (error: unknown) {
        this.logger.error(`Failed to subscribe to ${channel}: ${getErrorMessage(error)}`);
        return false;
      }
    }

    return true;
  }

  /**
   * Unsubscribe from a channel
   */
  async unsubscribe(channel: string, callback?: RedisMessageHandler): Promise<boolean> {
    if (callback) {
      // Remove specific callback
      const callbacks = this.subscriptions.get(channel) || [];
      const index = callbacks.indexOf(callback);
      if (index > -1) {
        callbacks.splice(index, 1);
      }
      if (callbacks.length === 0) {
        this.subscriptions.delete(channel);
      }
    } else {
      // Remove all callbacks
      this.subscriptions.delete(channel);
    }

    // Unsubscribe from Redis if no more callbacks
    if (!this.subscriptions.has(channel) && this.useRedis && this.subscriber && this.isConnected) {
      try {
        await this.subscriber.unsubscribe(channel);
        this.logger.debug(`Unsubscribed from Redis channel: ${channel}`);
      } catch (error: unknown) {
        this.logger.error(`Failed to unsubscribe from ${channel}: ${getErrorMessage(error)}`);
        return false;
      }
    }

    return true;
  }

  /**
   * Get connection status
   */
  getConnectionStatus(): { connected: boolean; useRedis: boolean } {
    return {
      connected: this.isConnected,
      useRedis: this.useRedis,
    };
  }

  /**
   * Check if Redis is available and connected
   */
  isRedisAvailable(): boolean {
    return this.useRedis && this.isConnected;
  }
}
