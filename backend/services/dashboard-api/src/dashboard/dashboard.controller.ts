import {
  Body,
  Controller,
  Get,
  Param,
  Post,
  UseGuards,
} from '@nestjs/common';
import { AuthGuard } from '@nestjs/passport';
import {
  ApiBearerAuth,
  ApiCreatedResponse,
  ApiForbiddenResponse,
  ApiNotFoundResponse,
  ApiOkResponse,
  ApiOperation,
  ApiServiceUnavailableResponse,
  ApiTags,
  ApiUnauthorizedResponse,
} from '@nestjs/swagger';
import { CurrentUser, RawToken, Roles } from '../auth/decorators';
import { RolesGuard } from '../auth/roles.guard';
import { JwtPayload } from '../auth/jwt.strategy';
import { DashboardService } from './dashboard.service';
import { TasksService } from './tasks.service';
import { SummaryQueryDto } from './dto/summary-query.dto';
import { SummaryResponseDto } from './dto/summary.dto';
import { CreateTaskDto } from './dto/create-task.dto';
import { TaskCreatedDto, TaskResponseDto } from './dto/task.dto';

// Декоратор для принятия query-параметров без ValidationPipe на уровне метода
import { Query } from '@nestjs/common';

@ApiTags('dashboard')
@ApiBearerAuth()
@UseGuards(AuthGuard('jwt'), RolesGuard)
@Controller()
export class DashboardController {
  constructor(
    private readonly dashboardService: DashboardService,
    private readonly tasksService: TasksService,
  ) {}

  // -------------------------------------------------------------------------
  // GET /v1/dashboard/summary
  // Быстрый эндпоинт с Redis-кэшем 5 мин. Роли: hr, director (UC-13).
  // -------------------------------------------------------------------------

  @Get('summary')
  @Roles('hr', 'director')
  @ApiOperation({
    summary: 'Сводная аналитика дашборда',
    description:
      'Возвращает coverage_percent (средний % K3+ по компетенциям), ' +
      'grade_distribution, top_gaps (топ-5 KPI ниже цели) и kpi_summary. ' +
      'Данные кэшируются в Redis на 5 минут. ' +
      'При промахе кэша выполняет два параллельных запроса к reports-api.',
  })
  @ApiOkResponse({ type: SummaryResponseDto })
  @ApiUnauthorizedResponse({ description: 'Отсутствует или истёк JWT-токен' })
  @ApiForbiddenResponse({ description: 'Нет доступа к дашборду' })
  @ApiServiceUnavailableResponse({ description: 'reports-api недоступен' })
  async getSummary(
    @Query() query: SummaryQueryDto,
    @RawToken() token: string,
    @CurrentUser() _user: JwtPayload,
  ): Promise<SummaryResponseDto> {
    return this.dashboardService.getSummary(query, token);
  }

  // -------------------------------------------------------------------------
  // POST /v1/dashboard/tasks
  // Создаёт тяжёлую задачу, возвращает task_id сразу. Роли: hr, director.
  // -------------------------------------------------------------------------

  @Post('tasks')
  @Roles('hr', 'director')
  @ApiOperation({
    summary: 'Создать асинхронную задачу агрегации',
    description:
      'Ставит тяжёлую задачу в асинхронную обработку и немедленно возвращает ' +
      'task_id. Результат доступен через GET /v1/dashboard/tasks/:id. ' +
      'Задача хранится в Redis 1 час. ' +
      'task_type=company_summary — полная сводка по компании; ' +
      'task_type=department_breakdown — сводка по каждому из department_ids (макс. 20).',
  })
  @ApiCreatedResponse({ type: TaskCreatedDto })
  @ApiUnauthorizedResponse({ description: 'Отсутствует или истёк JWT-токен' })
  @ApiForbiddenResponse({ description: 'Нет доступа к созданию задач' })
  async createTask(
    @Body() dto: CreateTaskDto,
    @RawToken() token: string,
    @CurrentUser() _user: JwtPayload,
  ): Promise<TaskCreatedDto> {
    return this.tasksService.createTask(dto, token);
  }

  // -------------------------------------------------------------------------
  // GET /v1/dashboard/tasks/:id
  // Опрос статуса задачи. Роли: hr, director.
  // -------------------------------------------------------------------------

  @Get('tasks/:id')
  @Roles('hr', 'director')
  @ApiOperation({
    summary: 'Получить статус и результат задачи',
    description:
      'Возвращает статус задачи (pending | running | completed | failed) ' +
      'и результат при status=completed. Задача хранится 1 час после создания.',
  })
  @ApiOkResponse({ type: TaskResponseDto })
  @ApiNotFoundResponse({ description: 'Задача не найдена или истекла' })
  @ApiUnauthorizedResponse({ description: 'Отсутствует или истёк JWT-токен' })
  @ApiForbiddenResponse({ description: 'Нет доступа к задачам' })
  async getTask(@Param('id') id: string): Promise<TaskResponseDto> {
    return this.tasksService.getTask(id);
  }
}
