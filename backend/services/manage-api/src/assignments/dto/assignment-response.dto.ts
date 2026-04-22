import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { AssignmentStatus } from '../../../generated/prisma';

export class AssignmentResponseDto {
  @ApiProperty() assignmentId!: string;
  @ApiProperty() employeeId!: string;
  @ApiProperty() testId!: string;
  @ApiProperty() assignedBy!: string;
  @ApiProperty({ enum: AssignmentStatus }) status!: AssignmentStatus;
  @ApiPropertyOptional() deadline!: Date | null;
  @ApiProperty() assignedAt!: Date;
  @ApiProperty() updatedAt!: Date;
}
