import { Controller, Get, Query, UseGuards } from '@nestjs/common';
import { AuthGuard } from '@nestjs/passport';
import { ApiBearerAuth, ApiOperation, ApiTags } from '@nestjs/swagger';
import { Roles } from '../auth/decorators';
import { RolesGuard } from '../auth/roles.guard';
import { EmployeesService, QueryEmployeesDto } from './employees.service';

@ApiTags('employees')
@ApiBearerAuth()
@UseGuards(AuthGuard('jwt'), RolesGuard)
@Roles('hr', 'director')
@Controller('v1/employees')
export class EmployeesController {
  constructor(private readonly svc: EmployeesService) {}

  @Get()
  @ApiOperation({ summary: 'Список активных сотрудников (поиск, фильтр по подразделению)' })
  findAll(@Query() query: QueryEmployeesDto) {
    return this.svc.findAll(query);
  }
}
