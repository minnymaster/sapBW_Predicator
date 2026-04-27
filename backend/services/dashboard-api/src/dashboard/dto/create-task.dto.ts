import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import {
  ArrayMaxSize,
  IsArray,
  IsDateString,
  IsEnum,
  IsOptional,
  IsUUID,
} from 'class-validator';

export enum TaskType {
  COMPANY_SUMMARY = 'company_summary',
  DEPARTMENT_BREAKDOWN = 'department_breakdown',
}

export class CreateTaskDto {
  @ApiProperty({
    enum: TaskType,
    example: 'department_breakdown',
    description:
      'company_summary — сводка по всей компании без фильтра подразделения; ' +
      'department_breakdown — сводка по каждому из указанных department_ids.',
  })
  @IsEnum(TaskType)
  task_type: TaskType;

  @ApiPropertyOptional({
    type: [String],
    example: ['uuid1', 'uuid2'],
    description: 'UUID подразделений (только для department_breakdown). Макс. 20.',
  })
  @IsOptional()
  @IsArray()
  @IsUUID('4', { each: true })
  @ArrayMaxSize(20)
  department_ids?: string[];

  @ApiPropertyOptional({ example: '2025-01-01' })
  @IsOptional()
  @IsDateString()
  period_from?: string;

  @ApiPropertyOptional({ example: '2025-12-31' })
  @IsOptional()
  @IsDateString()
  period_to?: string;
}
