import { Module } from '@nestjs/common';
import { HttpModule } from '@nestjs/axios';
import { ConfigModule, ConfigService } from '@nestjs/config';
import { ReportsClientService } from './reports-client.service';

@Module({
  imports: [
    HttpModule.registerAsync({
      imports: [ConfigModule],
      inject: [ConfigService],
      useFactory: (cfg: ConfigService) => ({
        timeout: cfg.get<number>('HTTP_TIMEOUT_MS', 10_000),
        maxRedirects: 0,
      }),
    }),
  ],
  providers: [ReportsClientService],
  exports: [ReportsClientService],
})
export class HttpClientsModule {}
