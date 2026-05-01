import { Controller, Get, UseGuards } from '@nestjs/common';
import { AuthGuard } from '@nestjs/passport';
import { ApiBearerAuth, ApiOperation, ApiTags } from '@nestjs/swagger';
import { DashboardService } from './dashboard.service';
import { CurrentUser } from '../auth/decorators';
import { JwtPayload } from '../auth/jwt.strategy';

@ApiTags('dashboard')
@ApiBearerAuth()
@UseGuards(AuthGuard('jwt'))
@Controller('dashboard')
export class DashboardController {
  constructor(private readonly svc: DashboardService) {}

  /**
   * GET /v1/dashboard/summary
   * Сводка по компетенциям сотрудника: текущий грейд, покрытие K3+,
   * список компетенций с баллами, ближайшие активные тесты.
   */
  @Get('summary')
  @ApiOperation({ summary: 'Сводка компетенций сотрудника (UC-13)' })
  getSummary(@CurrentUser() user: JwtPayload) {
    return this.svc.getEmployeeSummary(user.sub);
  }
}
