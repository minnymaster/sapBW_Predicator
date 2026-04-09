import { Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
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
