import {
  Injectable,
  Logger,
  OnModuleDestroy,
  OnModuleInit,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import Redis from 'ioredis';

/** TTL кэша сводки (5 минут, NFR-17) */
export const CACHE_TTL_SECONDS = 300;

/** TTL результата задачи в Redis (1 час) */
export const TASK_TTL_SECONDS = 3600;

@Injectable()
export class RedisService implements OnModuleInit, OnModuleDestroy {
  private readonly logger = new Logger(RedisService.name);
  private client!: Redis;

  constructor(private readonly config: ConfigService) {}

  onModuleInit() {
    this.client = new Redis({
      host: this.config.get<string>('REDIS_HOST', 'localhost'),
      port: this.config.get<number>('REDIS_PORT', 6379),
      ...(this.config.get<string>('REDIS_PASSWORD')
        ? { password: this.config.get<string>('REDIS_PASSWORD') }
        : {}),
      lazyConnect: true,
      enableReadyCheck: true,
      maxRetriesPerRequest: 3,
    });

    this.client.on('connect', () => this.logger.log('Redis connected'));
    this.client.on('error', (err: Error) =>
      this.logger.error('Redis error', err.message),
    );

    void this.client.connect();
  }

  async onModuleDestroy() {
    await this.client.quit();
  }

  async get<T>(key: string): Promise<T | null> {
    const raw = await this.client.get(key);
    if (!raw) return null;
    return JSON.parse(raw) as T;
  }

  async set(key: string, value: unknown, ttlSeconds: number): Promise<void> {
    await this.client.set(key, JSON.stringify(value), 'EX', ttlSeconds);
  }

  async del(key: string): Promise<void> {
    await this.client.del(key);
  }

  /** Оставшееся время жизни ключа (-1 = без TTL, -2 = не существует) */
  async ttl(key: string): Promise<number> {
    return this.client.ttl(key);
  }
}
