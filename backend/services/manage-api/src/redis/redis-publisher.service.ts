import {
  Injectable,
  Logger,
  OnModuleDestroy,
  OnModuleInit,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import Redis from 'ioredis';

/** Канал Redis Pub/Sub для событий назначений */
export const ASSIGNMENTS_CHANNEL = 'sapbw:notifications';

export interface RedisEvent<T = unknown> {
  event: string;
  data: T;
}

@Injectable()
export class RedisPublisherService implements OnModuleInit, OnModuleDestroy {
  private readonly logger = new Logger(RedisPublisherService.name);
  private client!: Redis;

  constructor(private readonly config: ConfigService) {}

  onModuleInit() {
    this.client = new Redis({
      host: this.config.get<string>('REDIS_HOST', 'localhost'),
      port: this.config.get<number>('REDIS_PORT', 6379),
      ...(this.config.get<string>('REDIS_PASSWORD')
        ? { password: this.config.get<string>('REDIS_PASSWORD') }
        : {}),
      // Pub/Sub connection не используется для команд чтения/записи — отдельный клиент
      lazyConnect: true,
    });

    this.client.on('connect', () =>
      this.logger.log('Redis publisher connected'),
    );
    this.client.on('error', (err: Error) =>
      this.logger.error('Redis publisher error', err.message),
    );

    void this.client.connect();
  }

  async onModuleDestroy() {
    await this.client.quit();
  }

  async publish<T>(channel: string, event: RedisEvent<T>): Promise<void> {
    await this.client.publish(channel, JSON.stringify(event));
    this.logger.debug(`Published ${event.event} → ${channel}`);
  }
}
