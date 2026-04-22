import { ApiPropertyOptional } from '@nestjs/swagger';
import { Type } from 'class-transformer';
import { IsEnum, IsInt, IsOptional, IsUUID, Max, Min } from 'class-validator';
import { DifficultyLevel } from '../../../generated/certification-prisma';

export class QueryQuestionsDto {
  @ApiPropertyOptional({ description: 'UUID компетенции (фильтр)' })
  @IsOptional()
  @IsUUID()
  competencyId?: string;

  @ApiPropertyOptional({ enum: DifficultyLevel, description: 'Уровень сложности' })
  @IsOptional()
  @IsEnum(DifficultyLevel)
  difficulty?: DifficultyLevel;

  @ApiPropertyOptional({ default: 1, minimum: 1 })
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  page?: number = 1;

  @ApiPropertyOptional({ default: 20, minimum: 1, maximum: 100 })
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  @Max(100)
  limit?: number = 20;
}
