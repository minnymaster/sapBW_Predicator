import {
  Injectable,
  Logger,
  NotFoundException,
} from '@nestjs/common';
import { v4 as uuidv4 } from 'uuid';
import { RedisService, TASK_TTL_SECONDS } from '../redis/redis.service';
import { DashboardService } from './dashboard.service';
import { CreateTaskDto, TaskType } from './dto/create-task.dto';
import {
  TaskCreatedDto,
  TaskRecord,
  TaskResponseDto,
  TaskStatus,
} from './dto/task.dto';
import { SummaryQueryDto } from './dto/summary-query.dto';
import { SummaryResponseDto } from './dto/summary.dto';

// Результат задачи department_breakdown — сводка по каждому отделу
interface DepartmentBreakdownResult {
  task_type: TaskType.DEPARTMENT_BREAKDOWN;
  departments: Array<{
    department_id: string;
    summary: SummaryResponseDto;
  }>;
  computed_at: string;
}

// Результат задачи company_summary
interface CompanySummaryResult {
  task_type: TaskType.COMPANY_SUMMARY;
  summary: SummaryResponseDto;
  computed_at: string;
}

type TaskResult = CompanySummaryResult | DepartmentBreakdownResult;

@Injectable()
export class TasksService {
  private readonly logger = new Logger(TasksService.name);

  constructor(
    private readonly redis: RedisService,
    private readonly dashboard: DashboardService,
  ) {}

  // ---------------------------------------------------------------------------
  // POST /v1/dashboard/tasks
  // Создаёт запись в Redis, немедленно запускает фоновую задачу (fire-and-forget),
  // возвращает task_id без ожидания результата.
  // ---------------------------------------------------------------------------

  async createTask(dto: CreateTaskDto, jwtToken: string): Promise<TaskCreatedDto> {
    const taskId = uuidv4();
    const now = new Date().toISOString();

    const record: TaskRecord = {
      task_id: taskId,
      task_type: dto.task_type,
      status: TaskStatus.PENDING,
      params: dto as unknown as Record<string, unknown>,
      jwt_token: jwtToken,
      result: null,
      error: null,
      created_at: now,
      completed_at: null,
    };

    await this.redis.set(this.taskKey(taskId), record, TASK_TTL_SECONDS);
    this.logger.log(`Task created: ${taskId} type=${dto.task_type}`);

    // Запуск фоновой обработки — не ждём результата
    void this.runTask(taskId, dto, jwtToken);

    return { task_id: taskId, status: TaskStatus.PENDING, created_at: now };
  }

  // ---------------------------------------------------------------------------
  // GET /v1/dashboard/tasks/:id
  // ---------------------------------------------------------------------------

  async getTask(taskId: string): Promise<TaskResponseDto> {
    const record = await this.redis.get<TaskRecord>(this.taskKey(taskId));
    if (!record) {
      throw new NotFoundException(`Task '${taskId}' not found or expired`);
    }

    return {
      task_id: record.task_id,
      status: record.status,
      result: record.result,
      error: record.error,
      created_at: record.created_at,
      completed_at: record.completed_at,
    };
  }

  // ---------------------------------------------------------------------------
  // Private: фоновое выполнение задачи.
  // Обновляет статус в Redis: pending → running → completed/failed.
  // ---------------------------------------------------------------------------

  private async runTask(
    taskId: string,
    dto: CreateTaskDto,
    jwtToken: string,
  ): Promise<void> {
    await this.updateTask(taskId, { status: TaskStatus.RUNNING });

    try {
      const result = await this.execute(dto, jwtToken);
      await this.updateTask(taskId, {
        status: TaskStatus.COMPLETED,
        result,
        completed_at: new Date().toISOString(),
      });
      this.logger.log(`Task completed: ${taskId}`);
    } catch (err) {
      const message = err instanceof Error ? err.message : String(err);
      await this.updateTask(taskId, {
        status: TaskStatus.FAILED,
        error: message,
        completed_at: new Date().toISOString(),
      });
      this.logger.error(`Task failed: ${taskId}`, message);
    }
  }

  // ---------------------------------------------------------------------------
  // Маршрутизация задачи по task_type
  // ---------------------------------------------------------------------------

  private async execute(dto: CreateTaskDto, jwtToken: string): Promise<TaskResult> {
    if (dto.task_type === TaskType.COMPANY_SUMMARY) {
      return this.executeCompanySummary(dto, jwtToken);
    }
    return this.executeDepartmentBreakdown(dto, jwtToken);
  }

  // company_summary — один вызов без фильтра подразделения, НЕ из кэша
  private async executeCompanySummary(
    dto: CreateTaskDto,
    jwtToken: string,
  ): Promise<CompanySummaryResult> {
    const query: SummaryQueryDto = {
      period_from: dto.period_from,
      period_to: dto.period_to,
    };
    // computeSummary обходит кэш — тяжёлый запрос должен получить актуальные данные
    const summary = await this.dashboard.computeSummary(query, jwtToken);
    return {
      task_type: TaskType.COMPANY_SUMMARY,
      summary,
      computed_at: new Date().toISOString(),
    };
  }

  // department_breakdown — параллельные вызовы по каждому department_id
  private async executeDepartmentBreakdown(
    dto: CreateTaskDto,
    jwtToken: string,
  ): Promise<DepartmentBreakdownResult> {
    const ids = dto.department_ids ?? [];

    // Параллельно, но не более 5 одновременных запросов (rate-limiting)
    const results: Array<{ department_id: string; summary: SummaryResponseDto }> = [];

    for (let i = 0; i < ids.length; i += 5) {
      const batch = ids.slice(i, i + 5);
      const batchResults = await Promise.all(
        batch.map(async (departmentId) => {
          const query: SummaryQueryDto = {
            department_id: departmentId,
            period_from: dto.period_from,
            period_to: dto.period_to,
          };
          const summary = await this.dashboard.computeSummary(query, jwtToken);
          return { department_id: departmentId, summary };
        }),
      );
      results.push(...batchResults);
    }

    return {
      task_type: TaskType.DEPARTMENT_BREAKDOWN,
      departments: results,
      computed_at: new Date().toISOString(),
    };
  }

  // ---------------------------------------------------------------------------
  // Атомарное обновление полей TaskRecord в Redis
  // ---------------------------------------------------------------------------

  private async updateTask(
    taskId: string,
    patch: Partial<TaskRecord>,
  ): Promise<void> {
    const key = this.taskKey(taskId);
    const record = await this.redis.get<TaskRecord>(key);
    if (!record) return; // задача уже истекла из Redis

    const updated = { ...record, ...patch };
    await this.redis.set(key, updated, TASK_TTL_SECONDS);
  }

  private taskKey(taskId: string): string {
    return `dashboard:task:${taskId}`;
  }
}
