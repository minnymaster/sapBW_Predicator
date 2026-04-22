import { ApiPropertyOptional, ApiProperty } from '@nestjs/swagger';
import { IsDateString, IsOptional, IsUUID } from 'class-validator';

export class CreateAssignmentDto {
  @ApiPropertyOptional({
    description: 'UUID сотрудника. Взаимоисключающий с departmentId.',
  })
  @IsOptional()
  @IsUUID()
  employeeId?: string;

  @ApiPropertyOptional({
    description:
      'UUID отдела. Назначение создаётся для всех активных сотрудников отдела. Взаимоисключающий с employeeId.',
  })
  @IsOptional()
  @IsUUID()
  departmentId?: string;

  @ApiProperty({ description: 'UUID теста из certification_db' })
  @IsUUID()
  testId!: string;

  @ApiPropertyOptional({
    description: 'Дедлайн прохождения (ISO 8601)',
    example: '2026-06-01T00:00:00.000Z',
  })
  @IsOptional()
  @IsDateString()
  dueDate?: string;
}
