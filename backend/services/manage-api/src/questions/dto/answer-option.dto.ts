import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import {
  IsBoolean,
  IsInt,
  IsOptional,
  IsString,
  Min,
  MinLength,
} from 'class-validator';

export class CreateAnswerOptionDto {
  @ApiProperty({ example: 'Моделирование на уровне InfoCube' })
  @IsString()
  @MinLength(1)
  text!: string;

  @ApiProperty()
  @IsBoolean()
  isCorrect!: boolean;

  @ApiPropertyOptional({ default: 0, minimum: 0 })
  @IsOptional()
  @IsInt()
  @Min(0)
  orderNumber?: number;
}

export class AnswerOptionResponseDto {
  @ApiProperty() optionId!: string;
  @ApiProperty() text!: string;
  @ApiProperty() isCorrect!: boolean;
  @ApiProperty() orderNumber!: number;
}
