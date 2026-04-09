import {
  IsEnum,
  IsString,
  IsUUID,
  IsOptional,
  IsBoolean,
  IsNumber,
  Min,
  Max,
  IsArray,
  ValidateNested,
  ArrayMinSize,
} from 'class-validator';
import { Type } from 'class-transformer';
import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';

class AnswerOptionDto {
  @ApiProperty() @IsString() text!: string;
  @ApiProperty() @IsBoolean() isCorrect!: boolean;
  @ApiPropertyOptional() @IsOptional() @IsNumber() orderNumber?: number;
}

export class CreateQuestionDto {
  @ApiProperty() @IsUUID() competencyId!: string;

  @ApiProperty({ enum: ['single_choice', 'multiple_choice', 'short_answer', 'open_text'] })
  @IsEnum(['single_choice', 'multiple_choice', 'short_answer', 'open_text'])
  type!: string;

  @ApiProperty({ enum: ['easy', 'medium', 'hard'] })
  @IsEnum(['easy', 'medium', 'hard'])
  difficulty!: string;

  @ApiProperty() @IsString() text!: string;

  @ApiPropertyOptional() @IsOptional() @IsString() explanation?: string;

  @ApiPropertyOptional({ default: 1.0 })
  @IsOptional() @IsNumber() @Min(0.1) @Max(100)
  maxScore?: number;

  @ApiPropertyOptional()
  @IsOptional()
  @IsArray()
  @ValidateNested({ each: true })
  @ArrayMinSize(2)
  @Type(() => AnswerOptionDto)
  answerOptions?: AnswerOptionDto[];
}
