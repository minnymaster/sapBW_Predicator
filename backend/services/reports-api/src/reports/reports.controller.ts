import {
  Controller,
  Get,
  Query,
  Res,
  UseGuards,
} from '@nestjs/common';
import { AuthGuard } from '@nestjs/passport';
import {
  ApiBearerAuth,
  ApiForbiddenResponse,
  ApiOkResponse,
  ApiOperation,
  ApiProduces,
  ApiTags,
  ApiUnauthorizedResponse,
} from '@nestjs/swagger';
import { Response } from 'express';
import { Roles } from '../auth/decorators';
import { RolesGuard } from '../auth/roles.guard';
import { CompetencyCoverageQueryDto } from './dto/competency-coverage-query.dto';
import { CompetencyCoverageResponseDto } from './dto/competency-coverage.dto';
import { ExportQueryDto } from './dto/export-query.dto';
import { KpiProgressQueryDto } from './dto/kpi-progress-query.dto';
import { KpiProgressResponseDto } from './dto/kpi-progress.dto';
import { ReportsService } from './reports.service';

@ApiTags('reports')
@ApiBearerAuth()
@UseGuards(AuthGuard('jwt'), RolesGuard)
@Controller()
export class ReportsController {
  constructor(private readonly reportsService: ReportsService) {}

  // -------------------------------------------------------------------------
  // GET /v1/reports/competency-coverage
  // Распределение грейдов по компетенциям. Роли: hr, director (UC-13, UC-14).
  // -------------------------------------------------------------------------

  @Get('competency-coverage')
  @Roles('hr', 'director')
  @ApiOperation({
    summary: 'Распределение грейдов по компетенциям',
    description:
      'Возвращает количество сотрудников с каждым грейдом (K1–K5) для каждой ' +
      'компетенции. Поддерживает фильтрацию по подразделению и периоду оценки.',
  })
  @ApiOkResponse({ type: CompetencyCoverageResponseDto })
  @ApiUnauthorizedResponse({ description: 'Отсутствует или истёк JWT-токен' })
  @ApiForbiddenResponse({ description: 'Роль не имеет доступа к отчётам' })
  async getCompetencyCoverage(
    @Query() query: CompetencyCoverageQueryDto,
  ): Promise<CompetencyCoverageResponseDto> {
    return this.reportsService.getCompetencyCoverage(query);
  }

  // -------------------------------------------------------------------------
  // GET /v1/reports/kpi-progress
  // Прогресс KPI подразделения. Роли: hr, director (UC-13, UC-15).
  // -------------------------------------------------------------------------

  @Get('kpi-progress')
  @Roles('hr', 'director')
  @ApiOperation({
    summary: 'Прогресс KPI подразделения',
    description:
      'Для каждого целевого KPI показывает, какой процент сотрудников достиг ' +
      'или превысил целевой грейд компетенции. Поле is_on_track = true, ' +
      'если actual_percent >= target_percent.',
  })
  @ApiOkResponse({ type: KpiProgressResponseDto })
  @ApiUnauthorizedResponse({ description: 'Отсутствует или истёк JWT-токен' })
  @ApiForbiddenResponse({ description: 'Роль не имеет доступа к отчётам' })
  async getKpiProgress(
    @Query() query: KpiProgressQueryDto,
  ): Promise<KpiProgressResponseDto> {
    return this.reportsService.getKpiProgress(query);
  }

  // -------------------------------------------------------------------------
  // GET /v1/reports/export?format=xlsx
  // Экспорт отчётов в Excel. Роли: hr, director (UC-14).
  // -------------------------------------------------------------------------

  @Get('export')
  @Roles('hr', 'director')
  @ApiOperation({
    summary: 'Экспорт отчётов в Excel (XLSX)',
    description:
      'Генерирует Excel-книгу с листами: «Покрытие компетенций», «Прогресс KPI» ' +
      'и «Попытки тестирования». Параметр report_type позволяет выбрать ' +
      'конкретный отчёт или all (по умолчанию).',
  })
  @ApiProduces('application/vnd.openxmlformats-officedocument.spreadsheetml.sheet')
  @ApiUnauthorizedResponse({ description: 'Отсутствует или истёк JWT-токен' })
  @ApiForbiddenResponse({ description: 'Роль не имеет доступа к экспорту' })
  async exportXlsx(
    @Query() query: ExportQueryDto,
    @Res() res: Response,
  ): Promise<void> {
    const buffer = await this.reportsService.generateExport(query);
    const filename = `report-${new Date().toISOString().slice(0, 10)}.xlsx`;

    res.set({
      'Content-Type':
        'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
      'Content-Disposition': `attachment; filename="${filename}"`,
      'Content-Length': buffer.length,
    });
    res.end(buffer);
  }
}
