import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';

export class KpiProgressItemDto {
  @ApiProperty({ example: 'uuid-kpi' })
  kpi_id: string;

  @ApiProperty({ example: 'uuid-competency' })
  competency_id: string;

  @ApiProperty({ example: 'Администрирование SAP BW' })
  competency_name: string;

  @ApiProperty({ example: 'K3', enum: ['K1', 'K2', 'K3', 'K4', 'K5'] })
  target_grade: string;

  @ApiProperty({ example: 80.0 })
  target_percent: number;

  @ApiProperty({ example: '2025-01-01' })
  period_start: string;

  @ApiPropertyOptional({ example: '2025-12-31', nullable: true })
  period_end: string | null;

  @ApiProperty({ example: 47 })
  total_employees: number;

  @ApiProperty({ example: 35 })
  met_count: number;

  @ApiProperty({ example: 74.47, description: 'Фактический % сотрудников, достигших целевого грейда' })
  actual_percent: number;

  @ApiProperty({ example: true, description: 'true если actual_percent >= target_percent' })
  is_on_track: boolean;
}

export class KpiProgressResponseDto {
  @ApiProperty({ type: [KpiProgressItemDto] })
  data: KpiProgressItemDto[];

  @ApiProperty({ example: 3 })
  total: number;

  @ApiProperty({ example: 'uuid-department', nullable: true })
  department_id: string | null;
}
