import {
  Body, Controller, Get, Param, ParseUUIDPipe, Patch, Post, UseGuards,
} from '@nestjs/common';
import { AuthGuard } from '@nestjs/passport';
import { ApiBearerAuth, ApiOperation, ApiTags } from '@nestjs/swagger';
import { AttemptsService } from './attempts.service';
import { SubmitAnswerDto } from './dto/submit-answer.dto';
import { CurrentUser, Roles } from '../auth/decorators';
import { RolesGuard } from '../auth/roles.guard';
import { JwtPayload } from '../auth/jwt.strategy';
import { RecommendationsService } from '../recommendations/recommendations.service';

@ApiTags('attempts')
@ApiBearerAuth()
@UseGuards(AuthGuard('jwt'))
@Controller('attempts')
export class AttemptsController {
  constructor(
    private readonly svc: AttemptsService,
    private readonly recommendationsSvc: RecommendationsService,
  ) {}

  /** UC-01: начать тест */
  @Post()
  start(
    @Body('testId', ParseUUIDPipe) testId: string,
    @CurrentUser() user: JwtPayload,
    @Body('assignmentId') assignmentId?: string,
  ) {
    return this.svc.start(testId, user.sub, assignmentId);
  }

  @Get(':id')
  findOne(@Param('id', ParseUUIDPipe) id: string) {
    return this.svc.findOne(id);
  }

  /**
   * UC-02: записать ответ на вопрос.
   * Для закрытых вопросов возвращает is_correct и explanation.
   */
  @Post(':id/answer')
  @ApiOperation({ summary: 'UC-02: записать ответ, вернуть is_correct и explanation' })
  submitAnswer(
    @Param('id', ParseUUIDPipe) id: string,
    @Body() dto: SubmitAnswerDto,
    @CurrentUser() user: JwtPayload,
  ) {
    return this.svc.submitAnswer(id, dto, user.sub);
  }

  /**
   * UC-03: завершить тест — подсчёт баллов, грейд К1–К5, запись CompetencyGap.
   * Вся операция в одной Prisma-транзакции (NFR-17).
   */
  @Post(':id/finish')
  @ApiOperation({ summary: 'UC-03: завершить тест, подсчитать грейд и CompetencyGap' })
  finish(
    @Param('id', ParseUUIDPipe) id: string,
    @CurrentUser() user: JwtPayload,
  ) {
    return this.svc.finish(id, user.sub);
  }

  /**
   * UC-04: получить рекомендации по завершённой попытке.
   * Если рекомендации ещё не созданы — запускает LLM-задачу через очередь.
   * Возвращает [{course_id, priority, explanation}].
   */
  @Get(':id/recommendations')
  @ApiOperation({ summary: 'UC-04: рекомендации по результатам попытки' })
  getRecommendations(
    @Param('id', ParseUUIDPipe) id: string,
    @CurrentUser() user: JwtPayload,
  ) {
    return this.recommendationsSvc.getOrGenerateForAttempt(id, user.sub);
  }

  /** UC-01: следующий вопрос в попытке — только роль employee */
  @Get(':id/next-question')
  @UseGuards(AuthGuard('jwt'), RolesGuard)
  @Roles('employee')
  @ApiOperation({ summary: 'UC-01: получить следующий вопрос попытки' })
  nextQuestion(
    @Param('id', ParseUUIDPipe) id: string,
    @CurrentUser() user: JwtPayload,
  ) {
    return this.svc.nextQuestion(id, user.sub);
  }
}
