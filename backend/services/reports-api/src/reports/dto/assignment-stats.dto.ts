import { ApiProperty } from '@nestjs/swagger';

export class AssignmentStatusCountsDto {
  @ApiProperty({ example: 45 }) pending!: number;
  @ApiProperty({ example: 30 }) in_progress!: number;
  @ApiProperty({ example: 35 }) completed!: number;
  @ApiProperty({ example: 8 })  overdue!: number;
  @ApiProperty({ example: 2 })  cancelled!: number;
}

export class AssignmentStatsDto {
  @ApiProperty({ example: 120 })
  total!: number;

  @ApiProperty({ type: AssignmentStatusCountsDto })
  by_status!: AssignmentStatusCountsDto;

  @ApiProperty({
    example: 6.67,
    description: '% просроченных от активных (pending + in_progress + overdue)',
  })
  overdue_percent!: number;
}
