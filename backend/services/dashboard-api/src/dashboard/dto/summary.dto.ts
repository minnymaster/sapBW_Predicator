import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';

export class GradeDistributionDto {
  @ApiProperty({ example: 10 }) K1: number;
  @ApiProperty({ example: 25 }) K2: number;
  @ApiProperty({ example: 40 }) K3: number;
  @ApiProperty({ example: 15 }) K4: number;
  @ApiProperty({ example: 5  }) K5: number;
}

export class TopGapDto {
  @ApiProperty({ example: 'uuid-competency' })
  competency_id: string;

  @ApiProperty({ example: 'Администрирование SAP BW' })
  competency_name: string;

  @ApiProperty({ example: 'K3', enum: ['K1', 'K2', 'K3', 'K4', 'K5'] })
  target_grade: string;

  @ApiProperty({ example: 80.0, description: 'Целевой % сотрудников с грейдом >= target_grade' })
  target_percent: number;

  @ApiProperty({ example: 52.5, description: 'Фактический %' })
  actual_percent: number;

  @ApiProperty({ example: 27.5, description: 'Разрыв: target_percent − actual_percent' })
  gap: number;
}

export class KpiSummaryDto {
  @ApiProperty({ example: 3, description: 'KPI, выполненных в срок' })
  on_track: number;

  @ApiProperty({ example: 5, description: 'Всего KPI-целей' })
  total: number;
}

export class SummaryResponseDto {
  @ApiPropertyOptional({ example: 'uuid-department', nullable: true })
  department_id: string | null;

  @ApiPropertyOptional({ example: '2025-01-01', nullable: true })
  period_from: string | null;

  @ApiPropertyOptional({ example: '2025-12-31', nullable: true })
  period_to: string | null;

  @ApiProperty({
    example: 72.5,
    description: 'Средний % сотрудников с грейдом K3+ по всем компетенциям',
  })
  coverage_percent: number;

  @ApiProperty({ type: GradeDistributionDto })
  grade_distribution: GradeDistributionDto;

  @ApiProperty({ type: [TopGapDto], description: 'Топ-5 компетенций с наибольшим разрывом KPI' })
  top_gaps: TopGapDto[];

  @ApiProperty({ type: KpiSummaryDto })
  kpi_summary: KpiSummaryDto;

  @ApiProperty({ example: '2026-04-27T10:00:00.000Z' })
  cached_at: string;

  @ApiProperty({ example: 300, description: 'TTL кэша (секунды)' })
  cache_ttl_seconds: number;
}
