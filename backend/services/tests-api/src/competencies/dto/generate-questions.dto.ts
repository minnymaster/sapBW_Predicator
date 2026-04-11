import { IsEnum, IsInt, IsOptional, Max, Min } from 'class-validator';
import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';

/**
 * Тело запроса POST /v1/competencies/:id/generate-questions.
 * competencyId не нужен — берётся из URL-параметра :id.
 */
export class GenerateQuestionsDto {
  @ApiProperty({ enum: ['single_choice', 'multiple_choice', 'short_answer', 'open_text'] })
  @IsEnum(['single_choice', 'multiple_choice', 'short_answer', 'open_text'])
  type!: string;

  @ApiProperty({ enum: ['easy', 'medium', 'hard'] })
  @IsEnum(['easy', 'medium', 'hard'])
  difficulty!: string;

  @ApiPropertyOptional({ default: 1, minimum: 1, maximum: 5 })
  @IsOptional() @IsInt() @Min(1) @Max(5)
  count?: number;
}
