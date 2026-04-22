import {
  BadRequestException,
  ConflictException,
  Injectable,
  Logger,
  NotFoundException,
} from '@nestjs/common';
import { Prisma } from '../../generated/certification-prisma';
import { randomUUID } from 'crypto';
import { CertificationPrismaService } from '../prisma/certification-prisma.service';
import { AnswerOptionResponseDto } from './dto/answer-option.dto';
import { CreateQuestionDto } from './dto/create-question.dto';
import { PaginatedQuestionsDto, QuestionResponseDto } from './dto/question-response.dto';
import { QueryQuestionsDto } from './dto/query-questions.dto';
import { UpdateQuestionDto } from './dto/update-question.dto';

type QuestionWithOptions = Prisma.QuestionGetPayload<{
  include: { answerOptions: true };
}>;

@Injectable()
export class QuestionsService {
  private readonly logger = new Logger(QuestionsService.name);

  constructor(private readonly certPrisma: CertificationPrismaService) {}

  // ---------------------------------------------------------------------------
  // GET /v1/questions — список текущих версий с фильтрами и пагинацией
  // ---------------------------------------------------------------------------

  async findAll(query: QueryQuestionsDto): Promise<PaginatedQuestionsDto> {
    const page = query.page ?? 1;
    const limit = query.limit ?? 20;
    const skip = (page - 1) * limit;

    const where: Prisma.QuestionWhereInput = {
      isCurrent: true,
      ...(query.competencyId && { competencyId: query.competencyId }),
      ...(query.difficulty && { difficulty: query.difficulty }),
    };

    const [data, total] = await this.certPrisma.$transaction([
      this.certPrisma.question.findMany({
        where,
        skip,
        take: limit,
        orderBy: { createdAt: 'desc' },
        include: { answerOptions: { orderBy: { orderNumber: 'asc' } } },
      }),
      this.certPrisma.question.count({ where }),
    ]);

    return {
      data: data.map((q) => this.mapToDto(q)),
      total,
      page,
      limit,
    };
  }

  // ---------------------------------------------------------------------------
  // POST /v1/questions — создать новый вопрос (версия 1)
  // ---------------------------------------------------------------------------

  async create(dto: CreateQuestionDto, userId: string): Promise<QuestionResponseDto> {
    // rootId = questionId версии 1 — логический ключ вопроса на все версии
    const rootId = randomUUID();

    try {
      const question = await this.certPrisma.question.create({
        data: {
          rootId,
          versionNumber: 1,
          competencyId: dto.competencyId,
          type: dto.type,
          difficulty: dto.difficulty,
          text: dto.text,
          explanation: dto.explanation,
          maxScore: dto.maxScore ?? 1.0,
          isCurrent: true,
          isLlmGenerated: false,
          createdBy: userId,
          answerOptions: dto.answerOptions
            ? {
                create: dto.answerOptions.map((opt) => ({
                  text: opt.text,
                  isCorrect: opt.isCorrect,
                  orderNumber: opt.orderNumber ?? 0,
                })),
              }
            : undefined,
        },
        include: { answerOptions: { orderBy: { orderNumber: 'asc' } } },
      });

      this.logger.log(
        `Question created: rootId=${rootId} competencyId=${dto.competencyId} by=${userId}`,
      );
      return this.mapToDto(question);
    } catch (e) {
      if (
        e instanceof Prisma.PrismaClientKnownRequestError &&
        e.code === 'P2003'
      ) {
        throw new BadRequestException(
          `Competency ${dto.competencyId} not found in certification_db`,
        );
      }
      throw e;
    }
  }

  // ---------------------------------------------------------------------------
  // PUT /v1/questions/:id — создать новую версию (NFR-18)
  // Транзакция: новая запись с version+1 + isCurrent=true, старая isCurrent=false
  // ---------------------------------------------------------------------------

  async update(
    id: string,
    dto: UpdateQuestionDto,
    userId: string,
  ): Promise<QuestionResponseDto> {
    const existing = await this.certPrisma.question.findFirst({
      where: { questionId: id, isCurrent: true },
      include: { answerOptions: { orderBy: { orderNumber: 'asc' } } },
    });

    if (!existing) {
      throw new NotFoundException(
        `Question ${id} not found or is not the current version`,
      );
    }

    const newQuestion = await this.certPrisma.$transaction(async (tx) => {
      // 1. Деактивировать текущую версию
      await tx.question.update({
        where: { questionId: id },
        data: { isCurrent: false },
      });

      // 2. Создать новую версию; незаполненные поля копируются из предыдущей
      const optionsToCreate =
        dto.answerOptions !== undefined
          ? dto.answerOptions.map((opt) => ({
              text: opt.text,
              isCorrect: opt.isCorrect,
              orderNumber: opt.orderNumber ?? 0,
            }))
          : existing.answerOptions.map((opt) => ({
              text: opt.text,
              isCorrect: opt.isCorrect,
              orderNumber: opt.orderNumber,
            }));

      return tx.question.create({
        data: {
          rootId: existing.rootId,
          versionNumber: existing.versionNumber + 1,
          competencyId: dto.competencyId ?? existing.competencyId,
          type: dto.type ?? existing.type,
          difficulty: dto.difficulty ?? existing.difficulty,
          text: dto.text ?? existing.text,
          explanation:
            dto.explanation !== undefined ? dto.explanation : existing.explanation,
          maxScore: dto.maxScore ?? Number(existing.maxScore),
          isCurrent: true,
          isLlmGenerated: false,
          createdBy: userId,
          answerOptions: { create: optionsToCreate },
        },
        include: { answerOptions: { orderBy: { orderNumber: 'asc' } } },
      });
    });

    this.logger.log(
      `Question versioned: rootId=${existing.rootId} v${existing.versionNumber}→v${existing.versionNumber + 1} by=${userId}`,
    );
    return this.mapToDto(newQuestion);
  }

  // ---------------------------------------------------------------------------
  // DELETE /v1/questions/:id — мягкое удаление (isCurrent=false)
  // Запрещено, если вопрос включён в активный тест
  // ---------------------------------------------------------------------------

  async delete(id: string): Promise<void> {
    const existing = await this.certPrisma.question.findFirst({
      where: { questionId: id, isCurrent: true },
    });

    if (!existing) {
      throw new NotFoundException(
        `Question ${id} not found or is not the current version`,
      );
    }

    // Проверяем, что ни одна версия с этим rootId не входит в активный тест
    const activeUsage = await this.certPrisma.testQuestion.findFirst({
      where: {
        question: { rootId: existing.rootId },
        test: { isActive: true },
      },
    });

    if (activeUsage) {
      throw new ConflictException(
        'Question is referenced by an active test and cannot be deleted',
      );
    }

    await this.certPrisma.question.update({
      where: { questionId: id },
      data: { isCurrent: false },
    });

    this.logger.log(
      `Question soft-deleted: questionId=${id} rootId=${existing.rootId}`,
    );
  }

  // ---------------------------------------------------------------------------
  // Helpers
  // ---------------------------------------------------------------------------

  private mapToDto(q: QuestionWithOptions): QuestionResponseDto {
    const options: AnswerOptionResponseDto[] = q.answerOptions.map((opt) => ({
      optionId: opt.optionId,
      text: opt.text,
      isCorrect: opt.isCorrect,
      orderNumber: opt.orderNumber,
    }));

    return {
      questionId: q.questionId,
      rootId: q.rootId,
      versionNumber: q.versionNumber,
      competencyId: q.competencyId,
      type: q.type,
      difficulty: q.difficulty,
      text: q.text,
      explanation: q.explanation,
      maxScore: Number(q.maxScore),
      isCurrent: q.isCurrent,
      isLlmGenerated: q.isLlmGenerated,
      createdBy: q.createdBy,
      createdAt: q.createdAt,
      answerOptions: options,
    };
  }
}
