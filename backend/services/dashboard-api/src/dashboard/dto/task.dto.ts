import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';

export enum TaskStatus {
  PENDING = 'pending',
  RUNNING = 'running',
  COMPLETED = 'completed',
  FAILED = 'failed',
}

export class TaskCreatedDto {
  @ApiProperty({ example: 'uuid-task-id' })
  task_id: string;

  @ApiProperty({ enum: TaskStatus, example: 'pending' })
  status: TaskStatus;

  @ApiProperty({ example: '2026-04-27T10:00:00.000Z' })
  created_at: string;
}

export class TaskResponseDto {
  @ApiProperty({ example: 'uuid-task-id' })
  task_id: string;

  @ApiProperty({ enum: TaskStatus, example: 'completed' })
  status: TaskStatus;

  @ApiPropertyOptional({ description: 'Результат (null пока задача не завершена)', nullable: true })
  result: unknown | null;

  @ApiPropertyOptional({ example: null, nullable: true, description: 'Текст ошибки при status=failed' })
  error: string | null;

  @ApiProperty({ example: '2026-04-27T10:00:00.000Z' })
  created_at: string;

  @ApiPropertyOptional({ example: '2026-04-27T10:00:05.000Z', nullable: true })
  completed_at: string | null;
}

// ---------------------------------------------------------------------------
// Внутренняя структура задачи, хранящаяся в Redis
// ---------------------------------------------------------------------------

export interface TaskRecord {
  task_id: string;
  task_type: string;
  status: TaskStatus;
  params: Record<string, unknown>;
  jwt_token: string;
  result: unknown | null;
  error: string | null;
  created_at: string;
  completed_at: string | null;
}
