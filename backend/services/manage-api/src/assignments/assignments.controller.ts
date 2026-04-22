import {
  Body,
  Controller,
  Delete,
  HttpCode,
  HttpStatus,
  Param,
  ParseUUIDPipe,
  Post,
  UseGuards,
} from '@nestjs/common';
import { AuthGuard } from '@nestjs/passport';
import {
  ApiBearerAuth,
  ApiNoContentResponse,
  ApiOperation,
  ApiResponse,
  ApiTags,
} from '@nestjs/swagger';
import { CurrentUser, Roles } from '../auth/decorators';
import { RolesGuard } from '../auth/roles.guard';
import { JwtPayload } from '../auth/jwt.strategy';
import { AssignmentsService } from './assignments.service';
import { AssignmentResponseDto } from './dto/assignment-response.dto';
import { CreateAssignmentDto } from './dto/create-assignment.dto';

@ApiTags('assignments')
@ApiBearerAuth()
@UseGuards(AuthGuard('jwt'), RolesGuard)
@Roles('hr')
@Controller('v1/assignments')
export class AssignmentsController {
  constructor(private readonly assignmentsService: AssignmentsService) {}

  /**
   * POST /v1/assignments
   * Создать назначение(я). Если передан departmentId — создаётся по одному
   * для каждого активного сотрудника отдела. После создания каждого
   * назначения публикуется событие assignment.created в Redis Pub/Sub.
   */
  @Post()
  @HttpCode(HttpStatus.CREATED)
  @ApiOperation({
    summary:
      'Назначить тест сотруднику или всему отделу. Публикует событие в Redis.',
  })
  @ApiResponse({ status: 201, type: [AssignmentResponseDto] })
  @ApiResponse({ status: 400, description: 'Невалидный запрос / неактивный тест или сотрудник' })
  @ApiResponse({ status: 404, description: 'Сотрудник / отдел / тест не найдены' })
  create(
    @Body() dto: CreateAssignmentDto,
    @CurrentUser() user: JwtPayload,
  ): Promise<AssignmentResponseDto[]> {
    return this.assignmentsService.create(dto, user.sub);
  }

  /**
   * DELETE /v1/assignments/:id
   * Отменить назначение (status → cancelled).
   * Нельзя отменить уже completed или overdue назначения.
   */
  @Delete(':id')
  @HttpCode(HttpStatus.NO_CONTENT)
  @ApiOperation({ summary: 'Отменить назначение' })
  @ApiNoContentResponse()
  @ApiResponse({ status: 400, description: 'Нельзя отменить назначение со статусом completed/overdue' })
  @ApiResponse({ status: 404, description: 'Назначение не найдено' })
  async delete(@Param('id', ParseUUIDPipe) id: string): Promise<void> {
    return this.assignmentsService.delete(id);
  }
}
