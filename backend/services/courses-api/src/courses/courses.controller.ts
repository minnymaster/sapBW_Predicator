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
import { CoursesService } from './courses.service';
import { CreateCourseDto } from './dto/create-course.dto';
import {
  CourseResponseDto,
  PaginatedCoursesDto,
} from './dto/course-response.dto';
import { QueryCoursesDto } from './dto/query-courses.dto';
import { UpdateCourseDto } from './dto/update-course.dto';

@ApiTags('courses')
@ApiBearerAuth()
@UseGuards(AuthGuard('jwt'), RolesGuard)
@Controller('v1/courses')
export class CoursesController {
  constructor(private readonly coursesService: CoursesService) {}

  /**
   * GET /v1/courses
   * Доступен всем ролям. Employee-SPA использует ?status=published.
   */
  @Get()
  @ApiOperation({ summary: 'Список курсов (пагинация, фильтр status)' })
  @ApiResponse({ status: 200, type: PaginatedCoursesDto })
  findAll(@Query() query: QueryCoursesDto): Promise<PaginatedCoursesDto> {
    return this.coursesService.findAll(query);
  }

  /**
   * GET /v1/courses/:id
   * Полный курс с вложенными модулями и списком материалов.
   */
  @Get(':id')
  @ApiOperation({ summary: 'Курс с вложенными модулями и материалами' })
  @ApiResponse({ status: 200, type: CourseResponseDto })
  @ApiResponse({ status: 404, description: 'Курс не найден' })
  findOne(@Param('id', ParseUUIDPipe) id: string): Promise<CourseResponseDto> {
    return this.coursesService.findOne(id);
  }

  /** POST /v1/courses — создать курс. Только HR. */
  @Post()
  @HttpCode(HttpStatus.CREATED)
  @Roles('hr')
  @ApiOperation({ summary: 'Создать курс' })
  @ApiResponse({ status: 201, type: CourseResponseDto })
  create(
    @Body() dto: CreateCourseDto,
    @CurrentUser() user: JwtPayload,
  ): Promise<CourseResponseDto> {
    return this.coursesService.create(dto, user.sub);
  }

  /** PUT /v1/courses/:id — обновить курс. Только HR. */
  @Put(':id')
  @Roles('hr')
  @ApiOperation({ summary: 'Обновить курс (статус published фиксирует publishedAt)' })
  @ApiResponse({ status: 200, type: CourseResponseDto })
  @ApiResponse({ status: 404, description: 'Курс не найден' })
  update(
    @Param('id', ParseUUIDPipe) id: string,
    @Body() dto: UpdateCourseDto,
    @CurrentUser() user: JwtPayload,
  ): Promise<CourseResponseDto> {
    return this.coursesService.update(id, dto, user.sub);
  }

  /**
   * DELETE /v1/courses/:id — архивирует курс (status=archived). Только HR.
   * Сохраняет историю прогресса сотрудников.
   */
  @Delete(':id')
  @HttpCode(HttpStatus.NO_CONTENT)
  @Roles('hr')
  @ApiOperation({ summary: 'Архивировать курс (status=archived)' })
  @ApiNoContentResponse()
  @ApiResponse({ status: 404, description: 'Курс не найден' })
  async delete(@Param('id', ParseUUIDPipe) id: string): Promise<void> {
    return this.coursesService.delete(id);
  }
}
