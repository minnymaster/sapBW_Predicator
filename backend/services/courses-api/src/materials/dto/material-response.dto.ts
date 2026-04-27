import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { MaterialType } from '../../../generated/prisma';

export class MaterialVersionDto {
  @ApiProperty() versionId!: string;
  @ApiProperty() versionNumber!: number;
  @ApiProperty({ description: 'SHA-256 fileKey или URL содержимого' })
  contentHash!: string;
  @ApiPropertyOptional() fileKey!: string | null;
  @ApiPropertyOptional() url!: string | null;
  @ApiPropertyOptional() changeNote!: string | null;
  @ApiProperty() isCurrent!: boolean;
  @ApiPropertyOptional() createdBy!: string | null;
  @ApiProperty() createdAt!: Date;
}

export class MaterialResponseDto {
  @ApiProperty() materialId!: string;
  @ApiProperty() moduleId!: string;
  @ApiProperty() title!: string;
  @ApiProperty({ enum: MaterialType }) type!: MaterialType;
  @ApiProperty() orderNumber!: number;
  @ApiPropertyOptional() fileKey!: string | null;
  @ApiPropertyOptional() url!: string | null;
  @ApiPropertyOptional() durationMin!: number | null;
  @ApiProperty() isActive!: boolean;
  @ApiPropertyOptional() createdBy!: string | null;
  @ApiProperty() createdAt!: Date;
  @ApiProperty() updatedAt!: Date;
  @ApiProperty({ type: MaterialVersionDto }) currentVersion!: MaterialVersionDto;
}
