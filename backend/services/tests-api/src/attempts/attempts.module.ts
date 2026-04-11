import { Module } from '@nestjs/common';
import { AttemptsService } from './attempts.service';
import { AttemptsController } from './attempts.controller';
import { LlmModule } from '../llm/llm.module';
import { RecommendationsModule } from '../recommendations/recommendations.module';

@Module({
  imports: [LlmModule, RecommendationsModule],
  controllers: [AttemptsController],
  providers: [AttemptsService],
  exports: [AttemptsService],
})
export class AttemptsModule {}
