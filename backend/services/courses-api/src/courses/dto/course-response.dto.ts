import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { CourseStatus, MaterialType } from '../../../generated/prisma';

export class MaterialSummaryDto {
  @ApiProperty() materialId!: string;
  @ApiProperty() title!: string;
  @ApiProperty({ enum: MaterialType }) type!: MaterialType;
  @ApiProperty() orderNumber!: number;
  @ApiProperty() isActive!: boolean;
  @ApiPropertyOptional() durationMin!: number | null;
}

export class ModuleDto {
  @ApiProperty() moduleId!: string;
  @ApiProperty() title!: string;
  @ApiPropertyOptional() description!: string | null;
  @ApiProperty() orderNumber!: number;
  @ApiProperty() createdAt!: Date;
  @ApiProperty() updatedAt!: Date;
  @ApiProperty({ type: [MaterialSummaryDto] }) materials!: MaterialSummaryDto[];
}

export class CourseResponseDto {
  @ApiProperty() courseId!: string;
  @ApiProperty() title!: string;
  @ApiPropertyOptional() description!: string | null;
  @ApiProperty({ enum: CourseStatus }) status!: CourseStatus;
  @ApiProperty({ type: [String] }) competencyIds!: string[];
  @ApiPropertyOptional() createdBy!: string | null;
  @ApiPropertyOptional() publishedAt!: Date | null;
  @ApiProperty() createdAt!: Date;
  @ApiProperty() updatedAt!: Date;
  /** Присутствует только в GET /v1/courses/:id */
  @ApiPropertyOptional({ type: [ModuleDto] }) modules?: ModuleDto[];
}

export class PaginatedCoursesDto {
  @ApiProperty({ type: [CourseResponseDto] }) data!: CourseResponseDto[];
  @ApiProperty() total!: number;
  @ApiProperty() page!: number;
  @ApiProperty() limit!: number;
}
