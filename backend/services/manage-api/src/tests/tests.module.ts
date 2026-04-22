import { Module } from '@nestjs/common';
import { AuthModule } from '../auth/auth.module';
import { RolesGuard } from '../auth/roles.guard';
import { TestsController } from './tests.controller';
import { TestsService } from './tests.service';

// CertificationPrismaService и PrismaService инжектируются через глобальные модули
@Module({
  imports: [AuthModule],
  controllers: [TestsController],
  providers: [TestsService, RolesGuard],
})
export class TestsModule {}
