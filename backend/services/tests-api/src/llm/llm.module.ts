import { Module } from '@nestjs/common';
import { BullModule } from '@nestjs/bull';
import { LlmService } from './llm.service';
import { LlmQueueService } from './llm-queue.service';
import { LlmProcessor } from './llm.processor';
import { LLM_QUEUE } from './llm-queue.constants';
import { PrismaModule } from '../prisma/prisma.module';

@Module({
  imports: [
    // Регистрация именованной очереди; Redis-подключение — в BullModule.forRootAsync (app.module.ts)
    BullModule.registerQueue({ name: LLM_QUEUE }),
    PrismaModule, // нужен LlmProcessor для обновления AnswerLog
  ],
  providers: [LlmService, LlmQueueService, LlmProcessor],
  exports: [LlmService, LlmQueueService],
})
export class LlmModule {}
