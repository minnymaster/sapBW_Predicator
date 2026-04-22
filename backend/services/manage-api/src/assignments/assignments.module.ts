import { Module } from '@nestjs/common';
import { AuthModule } from '../auth/auth.module';
import { RolesGuard } from '../auth/roles.guard';
import { AssignmentsController } from './assignments.controller';
import { AssignmentsService } from './assignments.service';

// PrismaService, CertificationPrismaService, RedisPublisherService —
// инжектируются через глобальные модули (PrismaModule, CertificationPrismaModule, RedisModule)
@Module({
  imports: [AuthModule],
  controllers: [AssignmentsController],
  providers: [AssignmentsService, RolesGuard],
})
export class AssignmentsModule {}
