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
import { CreateTestDto } from './dto/create-test.dto';
import { PaginatedTestsDto, TestResponseDto } from './dto/test-response.dto';
import { QueryTestsDto } from './dto/query-tests.dto';
import { UpdateTestDto } from './dto/update-test.dto';
import { TestsService } from './tests.service';

@ApiTags('tests')
@ApiBearerAuth()
@UseGuards(AuthGuard('jwt'), RolesGuard)
@Roles('hr')
@Controller('v1/tests')
export class TestsController {
  constructor(private readonly testsService: TestsService) {}

  /** GET /v1/tests — список тестов с пагинацией и фильтром isActive */
  @Get()
  @ApiOperation({ summary: 'Список тестов (пагинация, фильтр isActive)' })
  @ApiResponse({ status: 200, type: PaginatedTestsDto })
  findAll(@Query() query: QueryTestsDto): Promise<PaginatedTestsDto> {
    return this.testsService.findAll(query);
  }

  /** GET /v1/tests/:id — одиночный тест с количеством вопросов */
  @Get(':id')
  @ApiOperation({ summary: 'Тест по ID' })
  @ApiResponse({ status: 200, type: TestResponseDto })
  @ApiResponse({ status: 404, description: 'Тест не найден' })
  findOne(@Param('id', ParseUUIDPipe) id: string): Promise<TestResponseDto> {
    return this.testsService.findOne(id);
  }

  /** POST /v1/tests — создать тест, опционально с вопросами */
  @Post()
  @HttpCode(HttpStatus.CREATED)
  @ApiOperation({ summary: 'Создать тест' })
  @ApiResponse({ status: 201, type: TestResponseDto })
  create(
    @Body() dto: CreateTestDto,
    @CurrentUser() user: JwtPayload,
  ): Promise<TestResponseDto> {
    return this.testsService.create(dto, user.sub);
  }

  /**
   * PUT /v1/tests/:id — обновить метаданные теста.
   * Если в теле передан questionIds[], старые связи заменяются новыми (транзакция).
   */
  @Put(':id')
  @ApiOperation({ summary: 'Обновить тест (метаданные + опционально список вопросов)' })
  @ApiResponse({ status: 200, type: TestResponseDto })
  @ApiResponse({ status: 404, description: 'Тест не найден' })
  update(
    @Param('id', ParseUUIDPipe) id: string,
    @Body() dto: UpdateTestDto,
    @CurrentUser() user: JwtPayload,
  ): Promise<TestResponseDto> {
    return this.testsService.update(id, dto, user.sub);
  }

  /**
   * DELETE /v1/tests/:id — мягкое удаление (isActive=false).
   * Запрещено при наличии pending/in_progress назначений.
   */
  @Delete(':id')
  @HttpCode(HttpStatus.NO_CONTENT)
  @ApiOperation({ summary: 'Удалить тест (мягко; запрет при активных назначениях)' })
  @ApiNoContentResponse()
  @ApiResponse({ status: 404, description: 'Тест не найден' })
  @ApiResponse({ status: 409, description: 'Тест используется в активных назначениях' })
  async delete(@Param('id', ParseUUIDPipe) id: string): Promise<void> {
    return this.testsService.delete(id);
  }
}
