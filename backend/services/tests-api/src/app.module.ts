import { Module } from '@nestjs/common';
import { ConfigModule, ConfigService } from '@nestjs/config';
import { BullModule } from '@nestjs/bull';
import { PrismaModule } from './prisma/prisma.module';
import { AuthModule } from './auth/auth.module';
import { CompetenciesModule } from './competencies/competencies.module';
import { QuestionsModule } from './questions/questions.module';
import { TestsModule } from './tests/tests.module';
import { AttemptsModule } from './attempts/attempts.module';
import { RecommendationsModule } from './recommendations/recommendations.module';
import { LlmModule } from './llm/llm.module';

@Module({
  imports: [
    ConfigModule.forRoot({ isGlobal: true }),

    /**
     * BullModule.forRootAsync — глобальное Redis-подключение для всех очередей.
     * Env: REDIS_HOST (default: localhost), REDIS_PORT (default: 6379), REDIS_PASSWORD (optional)
     */
    BullModule.forRootAsync({
      inject: [ConfigService],
      useFactory: (cfg: ConfigService) => ({
        redis: {
          host: cfg.get<string>('REDIS_HOST', 'localhost'),
          port: cfg.get<number>('REDIS_PORT', 6379),
          ...(cfg.get<string>('REDIS_PASSWORD')
            ? { password: cfg.get<string>('REDIS_PASSWORD') }
            : {}),
        },
      }),
    }),

    PrismaModule,
    AuthModule,
    CompetenciesModule,
    QuestionsModule,
    TestsModule,
    AttemptsModule,
    RecommendationsModule,
    LlmModule,
  ],
})
export class AppModule {}
