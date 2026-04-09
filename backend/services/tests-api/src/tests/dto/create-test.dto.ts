import {
  IsString, IsOptional, IsInt, IsBoolean, Min, Max, IsNumber,
} from 'class-validator';
import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';

export class CreateTestDto {
  @ApiProperty() @IsString() title!: string;
  @ApiPropertyOptional() @IsOptional() @IsString() description?: string;
  @ApiPropertyOptional() @IsOptional() @IsInt() @Min(60) timeLimitSec?: number;
  @ApiPropertyOptional({ default: 70.0 }) @IsOptional() @IsNumber() @Min(0) @Max(100) passingScore?: number;
  @ApiPropertyOptional({ default: 1 }) @IsOptional() @IsInt() @Min(1) maxAttempts?: number;
  @ApiPropertyOptional({ default: false }) @IsOptional() @IsBoolean() isActive?: boolean;
}
