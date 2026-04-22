import {
  ConflictException,
  Injectable,
  Logger,
  NotFoundException,
} from '@nestjs/common';
import { Prisma as CertPrisma } from '../../generated/certification-prisma';
import { CertificationPrismaService } from '../prisma/certification-prisma.service';
import { PrismaService } from '../prisma/prisma.service';
import { CreateTestDto } from './dto/create-test.dto';
import { PaginatedTestsDto, TestResponseDto } from './dto/test-response.dto';
import { QueryTestsDto } from './dto/query-tests.dto';
import { UpdateTestDto } from './dto/update-test.dto';

type TestWithCount = CertPrisma.TestGetPayload<{
  include: { _count: { select: { testQuestions: true } } };
}>;

@Injectable()
export class TestsService {
  private readonly logger = new Logger(TestsService.name);

  constructor(
    private readonly certPrisma: CertificationPrismaService,
    private readonly prisma: PrismaService,
  ) {}

  // ---------------------------------------------------------------------------
  // GET /v1/tests
  // ---------------------------------------------------------------------------

  async findAll(query: QueryTestsDto): Promise<PaginatedTestsDto> {
    const page = query.page ?? 1;
    const limit = query.limit ?? 20;
    const skip = (page - 1) * limit;

    const where: CertPrisma.TestWhereInput = {
      ...(query.isActive !== undefined && { isActive: query.isActive }),
    };

    const [data, total] = await this.certPrisma.$transaction([
      this.certPrisma.test.findMany({
        where,
        skip,
        take: limit,
        orderBy: { createdAt: 'desc' },
        include: { _count: { select: { testQuestions: true } } },
      }),
      this.certPrisma.test.count({ where }),
    ]);

    return {
      data: data.map((t) => this.mapToDto(t)),
      total,
      page,
      limit,
    };
  }

  // ---------------------------------------------------------------------------
  // GET /v1/tests/:id
  // ---------------------------------------------------------------------------

  async findOne(id: string): Promise<TestResponseDto> {
    const test = await this.certPrisma.test.findUnique({
      where: { testId: id },
      include: { _count: { select: { testQuestions: true } } },
    });

    if (!test) throw new NotFoundException(`Test ${id} not found`);
    return this.mapToDto(test);
  }

  // ---------------------------------------------------------------------------
  // POST /v1/tests
  // ---------------------------------------------------------------------------

  async create(dto: CreateTestDto, userId: string): Promise<TestResponseDto> {
    const test = await this.certPrisma.test.create({
      data: {
        title: dto.title,
        description: dto.description,
        timeLimitSec: dto.timeLimitSec,
        passingScore: dto.passingScore ?? 70.0,
        maxAttempts: dto.maxAttempts ?? 1,
        isActive: dto.isActive ?? false,
        createdBy: userId,
        testQuestions: dto.questionIds
          ? {
              create: dto.questionIds.map((questionId, idx) => ({
                questionId,
                orderNumber: idx,
              })),
            }
          : undefined,
      },
      include: { _count: { select: { testQuestions: true } } },
    });

    this.logger.log(`Test created: testId=${test.testId} by=${userId}`);
    return this.mapToDto(test);
  }

  // ---------------------------------------------------------------------------
  // PUT /v1/tests/:id — обновляет метаданные; если questionIds передан,
  // удаляет старые связи и создаёт новые (атомарно через транзакцию)
  // ---------------------------------------------------------------------------

  async update(
    id: string,
    dto: UpdateTestDto,
    userId: string,
  ): Promise<TestResponseDto> {
    await this.assertExists(id);

    const test = await this.certPrisma.$transaction(async (tx) => {
      if (dto.questionIds !== undefined) {
        await tx.testQuestion.deleteMany({ where: { testId: id } });
        await tx.testQuestion.createMany({
          data: dto.questionIds.map((questionId, idx) => ({
            testId: id,
            questionId,
            orderNumber: idx,
          })),
        });
      }

      return tx.test.update({
        where: { testId: id },
        data: {
          ...(dto.title !== undefined && { title: dto.title }),
          ...(dto.description !== undefined && { description: dto.description }),
          ...(dto.timeLimitSec !== undefined && { timeLimitSec: dto.timeLimitSec }),
          ...(dto.passingScore !== undefined && { passingScore: dto.passingScore }),
          ...(dto.maxAttempts !== undefined && { maxAttempts: dto.maxAttempts }),
          ...(dto.isActive !== undefined && { isActive: dto.isActive }),
        },
        include: { _count: { select: { testQuestions: true } } },
      });
    });

    this.logger.log(`Test updated: testId=${id} by=${userId}`);
    return this.mapToDto(test);
  }

  // ---------------------------------------------------------------------------
  // DELETE /v1/tests/:id — мягкое удаление (isActive=false)
  // Запрещено, если есть активные назначения в company_db
  // ---------------------------------------------------------------------------

  async delete(id: string): Promise<void> {
    await this.assertExists(id);

    // Проверяем company_db: нет ли pending/in_progress назначений для этого теста
    const activeAssignment = await this.prisma.testAssignment.findFirst({
      where: {
        testId: id,
        status: { in: ['pending', 'in_progress'] },
      },
    });

    if (activeAssignment) {
      throw new ConflictException(
        'Test has active assignments (pending or in_progress) and cannot be deleted',
      );
    }

    await this.certPrisma.test.update({
      where: { testId: id },
      data: { isActive: false },
    });

    this.logger.log(`Test soft-deleted: testId=${id}`);
  }

  // ---------------------------------------------------------------------------
  // Helpers
  // ---------------------------------------------------------------------------

  private async assertExists(id: string): Promise<void> {
    const exists = await this.certPrisma.test.findUnique({
      where: { testId: id },
      select: { testId: true },
    });
    if (!exists) throw new NotFoundException(`Test ${id} not found`);
  }

  private mapToDto(t: TestWithCount): TestResponseDto {
    return {
      testId: t.testId,
      title: t.title,
      description: t.description,
      timeLimitSec: t.timeLimitSec,
      passingScore: Number(t.passingScore),
      maxAttempts: t.maxAttempts,
      isActive: t.isActive,
      createdBy: t.createdBy,
      questionCount: t._count.testQuestions,
      createdAt: t.createdAt,
      updatedAt: t.updatedAt,
    };
  }
}
