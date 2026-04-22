import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { DifficultyLevel, QuestionType } from '../../../generated/certification-prisma';
import { AnswerOptionResponseDto } from './answer-option.dto';

export class QuestionResponseDto {
  @ApiProperty() questionId!: string;
  @ApiProperty() rootId!: string;
  @ApiProperty() versionNumber!: number;
  @ApiProperty() competencyId!: string;
  @ApiProperty({ enum: QuestionType }) type!: QuestionType;
  @ApiProperty({ enum: DifficultyLevel }) difficulty!: DifficultyLevel;
  @ApiProperty() text!: string;
  @ApiPropertyOptional() explanation!: string | null;
  @ApiProperty() maxScore!: number;
  @ApiProperty() isCurrent!: boolean;
  @ApiProperty() isLlmGenerated!: boolean;
  @ApiPropertyOptional() createdBy!: string | null;
  @ApiProperty() createdAt!: Date;
  @ApiProperty({ type: [AnswerOptionResponseDto] }) answerOptions!: AnswerOptionResponseDto[];
}

export class PaginatedQuestionsDto {
  @ApiProperty({ type: [QuestionResponseDto] }) data!: QuestionResponseDto[];
  @ApiProperty() total!: number;
  @ApiProperty() page!: number;
  @ApiProperty() limit!: number;
}
