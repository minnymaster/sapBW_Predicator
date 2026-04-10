import { Injectable, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { LlmService } from '../llm/llm.service';
import { CreateQuestionDto } from './dto/create-question.dto';
import { GenerateQuestionDto } from './dto/generate-question.dto';
import { randomUUID } from 'crypto';

@Injectable()
export class QuestionsService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly llm: LlmService,
  ) {}

  /** Список активных вопросов по компетенции (только текущие версии) */
  findByCompetency(competencyId: string) {
    return this.prisma.question.findMany({
      where: { competencyId, isCurrent: true },
      include: { answerOptions: { orderBy: { orderNumber: 'asc' } } },
      orderBy: { createdAt: 'desc' },
    });
  }

  async findOne(questionId: string) {
    const q = await this.prisma.question.findUnique({
      where: { questionId },
      include: { answerOptions: { orderBy: { orderNumber: 'asc' } } },
    });
    if (!q) throw new NotFoundException(`Question ${questionId} not found`);
    return q;
  }

  /** Создание вопроса вручную (UC-08) */
  create(dto: CreateQuestionDto, createdBy: string) {
    const rootId = randomUUID();
    return this.prisma.question.create({
      data: {
        rootId,
        competencyId: dto.competencyId,
        type: dto.type as any,
        difficulty: dto.difficulty as any,
        text: dto.text,
        explanation: dto.explanation,
        maxScore: dto.maxScore ?? 1.0,
        isLlmGenerated: false,
        createdBy,
        answerOptions: dto.answerOptions
          ? { create: dto.answerOptions }
          : undefined,
      },
      include: { answerOptions: true },
    });
  }

  /**
   * LLM-генерация вопросов (UC-08, Tests API)
   * PROMPT_GENERATE_QUESTIONS — см. llm.service.ts
   */
  async generateViaLlm(dto: GenerateQuestionDto, createdBy: string) {
    const competency = await this.prisma.competency.findUnique({
      where: { competencyId: dto.competencyId },
    });
    if (!competency) throw new NotFoundException(`Competency ${dto.competencyId} not found`);

    // Преобразуем difficulty → грейд для PROMPT_GENERATE_QUESTIONS (см. llm.service.ts)
    const difficultyToGrade: Record<string, string> = {
      easy: 'K2',
      medium: 'K3',
      hard: 'K4',
    };
    const grade = difficultyToGrade[dto.difficulty] ?? 'K3';

    const generated = await this.llm.generateQuestions(
      { name: competency.name, area: competency.area, type: dto.type },
      grade,
      dto.count ?? 1,
    );

    // Сохраняем сгенерированные вопросы пакетом
    const created = await Promise.all(
      generated.map((q) =>
        this.prisma.question.create({
          data: {
            rootId: randomUUID(),
            competencyId: dto.competencyId,
            type: dto.type as any,
            difficulty: dto.difficulty as any,
            text: q.text,
            explanation: q.explanation,
            maxScore: 1.0,
            isLlmGenerated: true,
            createdBy,
            answerOptions: q.answerOptions
              ? { create: q.answerOptions }
              : undefined,
          },
          include: { answerOptions: true },
        }),
      ),
    );
    return created;
  }

  /**
   * Создание новой версии вопроса (NFR-18)
   * Деактивация старой версии происходит через trigger в custom_additions.sql
   */
  async createVersion(questionId: string, dto: CreateQuestionDto, createdBy: string) {
    const existing = await this.findOne(questionId);
    return this.prisma.question.create({
      data: {
        rootId: existing.rootId,
        versionNumber: existing.versionNumber + 1,
        competencyId: dto.competencyId,
        type: dto.type as any,
        difficulty: dto.difficulty as any,
        text: dto.text,
        explanation: dto.explanation,
        maxScore: dto.maxScore ?? 1.0,
        isLlmGenerated: false,
        createdBy,
        answerOptions: dto.answerOptions
          ? { create: dto.answerOptions }
          : undefined,
      },
      include: { answerOptions: true },
    });
  }
}
