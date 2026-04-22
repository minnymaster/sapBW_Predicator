import {
  Body,
  Controller,
  Delete,
  Get,
  HttpCode,
  HttpStatus,
  Param,
  ParseUUIDPipe,
  Post,
  Put,
  Query,
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
import { CreateQuestionDto } from './dto/create-question.dto';
import { PaginatedQuestionsDto, QuestionResponseDto } from './dto/question-response.dto';
import { QueryQuestionsDto } from './dto/query-questions.dto';
import { UpdateQuestionDto } from './dto/update-question.dto';
import { QuestionsService } from './questions.service';

@ApiTags('questions')
@ApiBearerAuth()
@UseGuards(AuthGuard('jwt'), RolesGuard)
@Roles('hr')
@Controller('v1/questions')
export class QuestionsController {
  constructor(private readonly questionsService: QuestionsService) {}

  /**
   * GET /v1/questions
   * Список текущих версий вопросов с фильтрацией и пагинацией. Только HR.
   */
  @Get()
  @ApiOperation({ summary: 'Список вопросов (фильтры: competency_id, difficulty, пагинация)' })
  @ApiResponse({ status: 200, type: PaginatedQuestionsDto })
  findAll(@Query() query: QueryQuestionsDto): Promise<PaginatedQuestionsDto> {
    return this.questionsService.findAll(query);
  }

  /**
   * POST /v1/questions
   * Создать новый вопрос (версия 1). Только HR.
   */
  @Post()
  @HttpCode(HttpStatus.CREATED)
  @ApiOperation({ summary: 'Создать вопрос (version=1)' })
  @ApiResponse({ status: 201, type: QuestionResponseDto })
  @ApiResponse({ status: 400, description: 'Компетенция не найдена или невалидные данные' })
  create(
    @Body() dto: CreateQuestionDto,
    @CurrentUser() user: JwtPayload,
  ): Promise<QuestionResponseDto> {
    return this.questionsService.create(dto, user.sub);
  }

  /**
   * PUT /v1/questions/:id
   * Создать новую версию вопроса (NFR-18). :id — questionId текущей версии.
   * Транзакция: новая запись version+1 isCurrent=true, старая isCurrent=false.
   */
  @Put(':id')
  @ApiOperation({ summary: 'Новая версия вопроса (NFR-18, транзакция)' })
  @ApiResponse({ status: 200, type: QuestionResponseDto })
  @ApiResponse({ status: 404, description: 'Вопрос не найден или уже не актуален' })
  update(
    @Param('id', ParseUUIDPipe) id: string,
    @Body() dto: UpdateQuestionDto,
    @CurrentUser() user: JwtPayload,
  ): Promise<QuestionResponseDto> {
    return this.questionsService.update(id, dto, user.sub);
  }

  /**
   * DELETE /v1/questions/:id
   * Мягкое удаление: isCurrent=false. Запрещено, если вопрос в активном тесте.
   */
  @Delete(':id')
  @HttpCode(HttpStatus.NO_CONTENT)
  @ApiOperation({ summary: 'Удалить вопрос (мягко; запрет если в активном тесте)' })
  @ApiNoContentResponse()
  @ApiResponse({ status: 404, description: 'Вопрос не найден' })
  @ApiResponse({ status: 409, description: 'Вопрос используется в активном тесте' })
  async delete(@Param('id', ParseUUIDPipe) id: string): Promise<void> {
    return this.questionsService.delete(id);
  }
}
