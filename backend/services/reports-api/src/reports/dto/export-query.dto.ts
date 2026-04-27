import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { IsEnum, IsOptional, IsUUID, IsDateString } from 'class-validator';

export enum ExportFormat {
  XLSX = 'xlsx',
}

export enum ReportType {
  COMPETENCY_COVERAGE = 'competency_coverage',
  KPI_PROGRESS = 'kpi_progress',
  ALL = 'all',
}

export class ExportQueryDto {
  @ApiProperty({ enum: ExportFormat, example: 'xlsx' })
  @IsEnum(ExportFormat)
  format: ExportFormat;

  @ApiPropertyOptional({ enum: ReportType, example: 'all', default: 'all' })
  @IsOptional()
  @IsEnum(ReportType)
  report_type?: ReportType;

  @ApiPropertyOptional({ description: 'UUID подразделения', example: 'a1b2c3d4-...' })
  @IsOptional()
  @IsUUID()
  department_id?: string;

  @ApiPropertyOptional({ description: 'Начало периода (YYYY-MM-DD)', example: '2025-01-01' })
  @IsOptional()
  @IsDateString()
  period_from?: string;

  @ApiPropertyOptional({ description: 'Конец периода (YYYY-MM-DD)', example: '2025-12-31' })
  @IsOptional()
  @IsDateString()
  period_to?: string;
}
