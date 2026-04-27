import { ApiProperty } from '@nestjs/swagger';

export class GradeDistributionDto {
  @ApiProperty({ example: 'uuid-...' })
  competency_id: string;

  @ApiProperty({ example: 'Моделирование данных SAP BW' })
  competency_name: string;

  @ApiProperty({ example: 5 })
  k1_count: number;

  @ApiProperty({ example: 12 })
  k2_count: number;

  @ApiProperty({ example: 20 })
  k3_count: number;

  @ApiProperty({ example: 8 })
  k4_count: number;

  @ApiProperty({ example: 2 })
  k5_count: number;

  @ApiProperty({ example: 47 })
  total_count: number;
}

export class CompetencyCoverageResponseDto {
  @ApiProperty({ type: [GradeDistributionDto] })
  data: GradeDistributionDto[];

  @ApiProperty({ example: 5 })
  total: number;

  @ApiProperty({ example: '2025-01-01' })
  period_from: string | null;

  @ApiProperty({ example: '2025-12-31' })
  period_to: string | null;

  @ApiProperty({ example: 'uuid-department' })
  department_id: string | null;
}
