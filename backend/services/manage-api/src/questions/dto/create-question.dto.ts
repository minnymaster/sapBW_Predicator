import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { Type } from 'class-transformer';
import {
  IsArray,
  IsEnum,
  IsNumber,
  IsOptional,
  IsString,
  IsUUID,
  Max,
  Min,
  MinLength,
  ValidateNested,
} from 'class-validator';
import { DifficultyLevel, QuestionType } from '../../../generated/certification-prisma';
import { CreateAnswerOptionDto } from './answer-option.dto';

export class CreateQuestionDto {
  @ApiProperty({ description: 'UUID компетенции из certification_db' })
  @IsUUID()
  competencyId!: string;

  @ApiProperty({ enum: QuestionType })
  @IsEnum(QuestionType)
  type!: QuestionType;

  @ApiProperty({ enum: DifficultyLevel })
  @IsEnum(DifficultyLevel)
  difficulty!: DifficultyLevel;

  @ApiProperty({ minLength: 10, example: 'Какой объект SAP BW отвечает за хранение данных на уровне InfoProvider?' })
  @IsString()
  @MinLength(10)
  text!: string;

  @ApiPropertyOptional({ description: 'Объяснение правильного ответа' })
  @IsOptional()
  @IsString()
  explanation?: string;

  @ApiPropertyOptional({ default: 1.0, minimum: 0.01, maximum: 100 })
  @IsOptional()
  @IsNumber({ maxDecimalPlaces: 2 })
  @Min(0.01)
  @Max(100)
  maxScore?: number;

  @ApiPropertyOptional({ type: [CreateAnswerOptionDto] })
  @IsOptional()
  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => CreateAnswerOptionDto)
  answerOptions?: CreateAnswerOptionDto[];
}
