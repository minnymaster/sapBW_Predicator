import {
  IsDateString, IsEnum, IsInt, IsOptional, IsString, IsUUID, Max, Min, MinLength,
} from 'class-validator';
import { CompetencyGrade } from '../../../generated/prisma';

export class CreateKpiDto {
  @IsUUID()
  @IsOptional()
  departmentId?: string;

  @IsUUID()
  competencyId!: string;

  @IsString()
  @MinLength(2)
  competencyName!: string;

  @IsEnum(CompetencyGrade)
  targetGrade!: CompetencyGrade;

  @IsInt()
  @Min(1)
  @Max(100)
  targetPercent!: number;

  @IsDateString()
  periodStart!: string;

  @IsDateString()
  @IsOptional()
  periodEnd?: string;
}
