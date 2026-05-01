import { Module } from '@nestjs/common';
import { AuthModule } from '../auth/auth.module';
import { RolesGuard } from '../auth/roles.guard';
import { KpiController } from './kpi.controller';
import { KpiService } from './kpi.service';

@Module({
  imports: [AuthModule],
  controllers: [KpiController],
  providers: [KpiService, RolesGuard],
})
export class KpiModule {}
