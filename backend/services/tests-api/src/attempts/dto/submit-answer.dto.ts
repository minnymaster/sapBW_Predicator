import { IsUUID, IsArray, IsOptional, IsString } from 'class-validator';
import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';

export class SubmitAnswerDto {
  @ApiProperty() @IsUUID() questionId!: string;

  @ApiPropertyOptional({ type: [String], description: 'UUID вариантов ответа (для single/multiple_choice)' })
  @IsOptional() @IsArray() @IsUUID('4', { each: true })
  selectedOptionIds?: string[];

  @ApiPropertyOptional({ description: 'Текстовый ответ (для short_answer/open_text)' })
  @IsOptional() @IsString()
  answerText?: string;
}
