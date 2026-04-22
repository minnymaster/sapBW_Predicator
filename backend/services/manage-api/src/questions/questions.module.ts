import { Module } from '@nestjs/common';
import { AuthModule } from '../auth/auth.module';
import { CertificationPrismaService } from '../prisma/certification-prisma.service';
import { RolesGuard } from '../auth/roles.guard';
import { QuestionsController } from './questions.controller';
import { QuestionsService } from './questions.service';

@Module({
  imports: [AuthModule],
  controllers: [QuestionsController],
  providers: [QuestionsService, CertificationPrismaService, RolesGuard],
})
export class QuestionsModule {}
