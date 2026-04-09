import { IsEnum, IsUUID, IsOptional, IsInt, Min, Max } from 'class-validator';
import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';

export class GenerateQuestionDto {
  @ApiProperty({ description: 'UUID компетенции из certification_db' })
  @IsUUID()
  competencyId!: string;

  @ApiProperty({ enum: ['easy', 'medium', 'hard'] })
  @IsEnum(['easy', 'medium', 'hard'])
  difficulty!: string;

  @ApiProperty({ enum: ['single_choice', 'multiple_choice', 'short_answer', 'open_text'] })
  @IsEnum(['single_choice', 'multiple_choice', 'short_answer', 'open_text'])
  type!: string;

  @ApiPropertyOptional({ default: 1, minimum: 1, maximum: 5 })
  @IsOptional() @IsInt() @Min(1) @Max(5)
  count?: number;
}
