import {
  Body, Controller, Delete, Get, HttpCode, HttpStatus,
  Param, ParseUUIDPipe, Post, Put, UseGuards,
} from '@nestjs/common';
import { AuthGuard } from '@nestjs/passport';
import { ApiBearerAuth, ApiOperation, ApiTags } from '@nestjs/swagger';
import { CurrentUser, Roles } from '../auth/decorators';
import { RolesGuard } from '../auth/roles.guard';
import { JwtPayload } from '../auth/jwt.strategy';
import { KpiService } from './kpi.service';
import { CreateKpiDto } from './dto/create-kpi.dto';

@ApiTags('kpi')
@ApiBearerAuth()
@UseGuards(AuthGuard('jwt'), RolesGuard)
@Roles('hr', 'director')
@Controller('v1/kpi')
export class KpiController {
  constructor(private readonly kpiService: KpiService) {}

  @Get()
  @ApiOperation({ summary: 'Список целевых KPI' })
  findAll() {
    return this.kpiService.findAll();
  }

  @Post()
  @HttpCode(HttpStatus.CREATED)
  @ApiOperation({ summary: 'Создать целевой KPI' })
  create(@Body() dto: CreateKpiDto, @CurrentUser() user: JwtPayload) {
    return this.kpiService.create(dto, user.sub);
  }

  @Put(':id')
  @ApiOperation({ summary: 'Обновить целевой KPI' })
  update(
    @Param('id', ParseUUIDPipe) id: string,
    @Body() dto: Partial<CreateKpiDto>,
  ) {
    return this.kpiService.update(id, dto);
  }

  @Delete(':id')
  @HttpCode(HttpStatus.NO_CONTENT)
  @ApiOperation({ summary: 'Удалить целевой KPI' })
  async delete(@Param('id', ParseUUIDPipe) id: string): Promise<void> {
    return this.kpiService.delete(id);
  }
}
