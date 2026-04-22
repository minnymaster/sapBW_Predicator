import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';

export class TestResponseDto {
  @ApiProperty() testId!: string;
  @ApiProperty() title!: string;
  @ApiPropertyOptional() description!: string | null;
  @ApiPropertyOptional() timeLimitSec!: number | null;
  @ApiProperty() passingScore!: number;
  @ApiProperty() maxAttempts!: number;
  @ApiProperty() isActive!: boolean;
  @ApiPropertyOptional() createdBy!: string | null;
  @ApiProperty() questionCount!: number;
  @ApiProperty() createdAt!: Date;
  @ApiProperty() updatedAt!: Date;
}

export class PaginatedTestsDto {
  @ApiProperty({ type: [TestResponseDto] }) data!: TestResponseDto[];
  @ApiProperty() total!: number;
  @ApiProperty() page!: number;
  @ApiProperty() limit!: number;
}
