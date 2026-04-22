import { Module } from '@nestjs/common';
import { AuthModule } from '../auth/auth.module';
import { RolesGuard } from '../auth/roles.guard';
import { QuestionsController } from './questions.controller';
import { QuestionsService } from './questions.service';

// CertificationPrismaService инжектируется через глобальный CertificationPrismaModule
@Module({
  imports: [AuthModule],
  controllers: [QuestionsController],
  providers: [QuestionsService, RolesGuard],
})
export class QuestionsModule {}
