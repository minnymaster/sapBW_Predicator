import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import {
  IsEnum,
  IsInt,
  IsOptional,
  IsString,
  IsUUID,
  IsUrl,
  Max,
  MaxLength,
  Min,
  MinLength,
} from 'class-validator';
import { MaterialType } from '../../../generated/prisma';

export class CreateMaterialDto {
  @ApiProperty({ description: 'UUID модуля, к которому относится материал' })
  @IsUUID()
  moduleId!: string;

  @ApiProperty({ minLength: 3, maxLength: 300 })
  @IsString()
  @MinLength(3)
  @MaxLength(300)
  title!: string;

  @ApiProperty({ enum: MaterialType })
  @IsEnum(MaterialType)
  type!: MaterialType;

  @ApiPropertyOptional({ default: 0, minimum: 0 })
  @IsOptional()
  @IsInt()
  @Min(0)
  orderNumber?: number;

  @ApiPropertyOptional({ description: 'Ключ в S3-хранилище (video, document, interactive)' })
  @IsOptional()
  @IsString()
  fileKey?: string;

  @ApiPropertyOptional({ description: 'Внешняя ссылка (link, article)' })
  @IsOptional()
  @IsUrl()
  url?: string;

  @ApiPropertyOptional({ description: 'Длительность в минутах', minimum: 1, maximum: 600 })
  @IsOptional()
  @IsInt()
  @Min(1)
  @Max(600)
  durationMin?: number;

  @ApiPropertyOptional({ description: 'Примечание к версии (для MaterialVersion)' })
  @IsOptional()
  @IsString()
  changeNote?: string;
}
