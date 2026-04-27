import {
  Injectable,
  Logger,
  NotFoundException,
} from '@nestjs/common';
import { CourseStatus, Prisma } from '../../generated/prisma';
import { PrismaService } from '../prisma/prisma.service';
import { CreateCourseDto } from './dto/create-course.dto';
import {
  CourseResponseDto,
  MaterialSummaryDto,
  ModuleDto,
  PaginatedCoursesDto,
} from './dto/course-response.dto';
import { QueryCoursesDto } from './dto/query-courses.dto';
import { UpdateCourseDto } from './dto/update-course.dto';

type CourseWithModules = Prisma.CourseGetPayload<{
  include: {
    modules: {
      include: { materials: { orderBy: [{ orderNumber: 'asc' }] } };
      orderBy: [{ orderNumber: 'asc' }];
    };
  };
}>;

@Injectable()
export class CoursesService {
  private readonly logger = new Logger(CoursesService.name);

  constructor(private readonly prisma: PrismaService) {}

  // ---------------------------------------------------------------------------
  // GET /v1/courses
  // ---------------------------------------------------------------------------

  async findAll(query: QueryCoursesDto): Promise<PaginatedCoursesDto> {
    const page = query.page ?? 1;
    const limit = query.limit ?? 20;
    const skip = (page - 1) * limit;

    const where: Prisma.CourseWhereInput = {
      ...(query.status && { status: query.status }),
    };

    const [data, total] = await this.prisma.$transaction([
      this.prisma.course.findMany({
        where,
        skip,
        take: limit,
        orderBy: { createdAt: 'desc' },
      }),
      this.prisma.course.count({ where }),
    ]);

    return {
      data: data.map((c) => this.mapToDto(c)),
      total,
      page,
      limit,
    };
  }

  // ---------------------------------------------------------------------------
  // GET /v1/courses/:id — полный курс с вложенными модулями и материалами
  // ---------------------------------------------------------------------------

  async findOne(id: string): Promise<CourseResponseDto> {
    const course = await this.prisma.course.findUnique({
      where: { courseId: id },
      include: {
        modules: {
          orderBy: { orderNumber: 'asc' },
          include: {
            materials: { orderBy: { orderNumber: 'asc' } },
          },
        },
      },
    });

    if (!course) throw new NotFoundException(`Course ${id} not found`);
    return this.mapToDto(course as CourseWithModules);
  }

  // ---------------------------------------------------------------------------
  // POST /v1/courses
  // ---------------------------------------------------------------------------

  async create(dto: CreateCourseDto, userId: string): Promise<CourseResponseDto> {
    const course = await this.prisma.course.create({
      data: {
        title: dto.title,
        description: dto.description,
        status: dto.status ?? CourseStatus.draft,
        competencyIds: dto.competencyIds ?? [],
        createdBy: userId,
        publishedAt:
          dto.status === CourseStatus.published ? new Date() : null,
      },
    });

    this.logger.log(`Course created: courseId=${course.courseId} by=${userId}`);
    return this.mapToDto(course);
  }

  // ---------------------------------------------------------------------------
  // PUT /v1/courses/:id
  // Если статус меняется на published — фиксируем publishedAt.
  // ---------------------------------------------------------------------------

  async update(
    id: string,
    dto: UpdateCourseDto,
    userId: string,
  ): Promise<CourseResponseDto> {
    await this.assertExists(id);

    const existing = await this.prisma.course.findUnique({
      where: { courseId: id },
      select: { status: true, publishedAt: true },
    });

    const becomesPublished =
      dto.status === CourseStatus.published &&
      existing!.status !== CourseStatus.published;

    const course = await this.prisma.course.update({
      where: { courseId: id },
      data: {
        ...(dto.title !== undefined && { title: dto.title }),
        ...(dto.description !== undefined && { description: dto.description }),
        ...(dto.status !== undefined && { status: dto.status }),
        ...(dto.competencyIds !== undefined && {
          competencyIds: dto.competencyIds,
        }),
        ...(becomesPublished && { publishedAt: new Date() }),
      },
    });

    this.logger.log(`Course updated: courseId=${id} by=${userId}`);
    return this.mapToDto(course);
  }

  // ---------------------------------------------------------------------------
  // DELETE /v1/courses/:id — архивирование (status=archived)
  // Сохраняет историю прогресса сотрудников.
  // ---------------------------------------------------------------------------

  async delete(id: string): Promise<void> {
    await this.assertExists(id);

    await this.prisma.course.update({
      where: { courseId: id },
      data: { status: CourseStatus.archived },
    });

    this.logger.log(`Course archived: courseId=${id}`);
  }

  // ---------------------------------------------------------------------------
  // Helpers
  // ---------------------------------------------------------------------------

  private async assertExists(id: string): Promise<void> {
    const exists = await this.prisma.course.findUnique({
      where: { courseId: id },
      select: { courseId: true },
    });
    if (!exists) throw new NotFoundException(`Course ${id} not found`);
  }

  private mapToDto(
    c: Prisma.CourseGetPayload<{
      include?: {
        modules?: {
          include?: { materials?: true };
        };
      };
    }>,
  ): CourseResponseDto {
    const withModules = c as CourseWithModules;

    const modules: ModuleDto[] | undefined = withModules.modules?.map((m) => ({
      moduleId: m.moduleId,
      title: m.title,
      description: m.description,
      orderNumber: m.orderNumber,
      createdAt: m.createdAt,
      updatedAt: m.updatedAt,
      materials: m.materials.map(
        (mat): MaterialSummaryDto => ({
          materialId: mat.materialId,
          title: mat.title,
          type: mat.type,
          orderNumber: mat.orderNumber,
          isActive: mat.isActive,
          durationMin: mat.durationMin,
        }),
      ),
    }));

    return {
      courseId: c.courseId,
      title: c.title,
      description: c.description,
      status: c.status,
      competencyIds: c.competencyIds,
      createdBy: c.createdBy,
      publishedAt: c.publishedAt,
      createdAt: c.createdAt,
      updatedAt: c.updatedAt,
      ...(modules !== undefined && { modules }),
    };
  }
}
