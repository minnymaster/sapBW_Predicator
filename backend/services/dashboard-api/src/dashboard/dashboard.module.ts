import { Module } from '@nestjs/common';
import { HttpClientsModule } from '../http-clients/http-clients.module';
import { DashboardController } from './dashboard.controller';
import { DashboardService } from './dashboard.service';
import { TasksService } from './tasks.service';

@Module({
  imports: [HttpClientsModule],
  controllers: [DashboardController],
  providers: [DashboardService, TasksService],
})
export class DashboardModule {}
