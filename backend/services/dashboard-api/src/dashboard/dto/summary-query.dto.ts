import { ApiPropertyOptional } from '@nestjs/swagger';
import { IsDateString, IsOptional, IsUUID } from 'class-validator';

export class SummaryQueryDto {
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
