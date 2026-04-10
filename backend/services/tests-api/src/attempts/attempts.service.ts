import {
  BadRequestException, Injectable, NotFoundException, ForbiddenException,
} from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { LlmService } from '../llm/llm.service';
import { SubmitAnswerDto } from './dto/submit-answer.dto';

// Числовой порядок грейдов — нужен для сравнения actualGrade < targetGrade
const GRADE_ORDER: Record<string, number> = {
  K1: 1, K2: 2, K3: 3, K4: 4, K5: 5,
};

@Injectable()
export class AttemptsService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly llm: LlmService,
  ) {}

  /** UC-01: начать тест */
  async start(testId: string, employeeId: string, assignmentId?: string) {
    const test = await this.prisma.test.findUnique({
      where: { testId },
      include: { testQuestions: true },
    });
    if (!test) throw new NotFoundException(`Test ${testId} not found`);
    if (!test.isActive) throw new BadRequestException('Test is not active');

    // Проверяем лимит попыток
    const prevAttempts = await this.prisma.testAttempt.count({
      where: { testId, employeeId },
    });
    if (prevAttempts >= test.maxAttempts) {
      throw new BadRequestException(`Max attempts (${test.maxAttempts}) exceeded`);
    }

    return this.prisma.testAttempt.create({
      data: {
        testId,
        employeeId,
        assignmentId,
        status: 'in_progress',
        timeLeftSec: test.timeLimitSec,
      },
    });
  }

  async findOne(attemptId: string) {
    const attempt = await this.prisma.testAttempt.findUnique({
      where: { attemptId },
      include: {
        test: true,
        answerLogs: true,
        competencyResults: true,
      },
    });
    if (!attempt) throw new NotFoundException(`Attempt ${attemptId} not found`);
    return attempt;
  }

  /**
   * UC-02: сохранить ответ на вопрос.
   * Для закрытых вопросов (single_choice, multiple_choice) возвращает
   * is_correct и explanation из поля question.explanation.
   */
  async submitAnswer(attemptId: string, dto: SubmitAnswerDto, employeeId: string) {
    const attempt = await this.findOne(attemptId);
    if (attempt.employeeId !== employeeId) throw new ForbiddenException();
    if (attempt.status !== 'in_progress') {
      throw new BadRequestException('Attempt is not in progress');
    }

    const question = await this.prisma.question.findUnique({
      where: { questionId: dto.questionId },
      include: { answerOptions: true },
    });
    if (!question) throw new NotFoundException(`Question ${dto.questionId} not found`);

    // Автоматическая проверка для закрытых вопросов
    let isCorrect: boolean | null = null;
    let score: number | null = null;
    const isClosed = ['single_choice', 'multiple_choice'].includes(question.type);

    if (isClosed) {
      const correctIds = question.answerOptions
        .filter((o) => o.isCorrect)
        .map((o) => o.optionId)
        .sort();
      const givenIds = [...(dto.selectedOptionIds ?? [])].sort();
      isCorrect = JSON.stringify(correctIds) === JSON.stringify(givenIds);
      score = isCorrect ? Number(question.maxScore) : 0;
    }

    const log = await this.prisma.answerLog.create({
      data: {
        attemptId,
        questionId: dto.questionId,
        selectedOptionIds: dto.selectedOptionIds ?? [],
        answerText: dto.answerText,
        isCorrect,
        score,
        needsHrReview: question.type === 'open_text',
      },
    });

    // Для open_text запускаем LLM-оценку асинхронно (не блокируем ответ)
    if (question.type === 'open_text' && dto.answerText) {
      this.llm
        .scoreOpenAnswer({
          questionText: question.text,
          answerText: dto.answerText,
          explanation: question.explanation ?? '',
        })
        .then((result) =>
          this.prisma.answerLog.update({
            where: { logId: log.logId },
            data: {
              llmScore: result.score,
              llmExplanation: result.explanation,
            },
          }),
        )
        .catch(() => {
          // LLM недоступен — HR проверяет вручную (needsHrReview уже = true)
        });
    }

    // Для закрытых вопросов возвращаем is_correct и explanation сразу
    return {
      ...log,
      logId: log.logId.toString(), // BigInt → string для JSON
      is_correct: isCorrect,
      explanation: isClosed ? (question.explanation ?? null) : null,
    };
  }

  /**
   * UC-03: завершить тест.
   * Пороги грейдов: К1 0–20%, К2 21–40%, К3 41–60%, К4 61–80%, К5 81–100%.
   * Вся операция выполняется в одной Prisma-транзакции (NFR-17):
   *   1. update TestAttempt (status, scores, gradeAchieved)
   *   2. createMany CompetencyResult (по каждой компетенции)
   *   3. createMany CompetencyGap (там, где actualGrade < competency.minGrade)
   */
  async finish(attemptId: string, employeeId: string) {
    // Загружаем попытку с AnswerLog → Question → Competency (вне транзакции — только чтение)
    const attempt = await this.prisma.testAttempt.findUnique({
      where: { attemptId },
      include: {
        answerLogs: {
          include: {
            question: {
              include: { competency: true },
            },
          },
        },
      },
    });

    if (!attempt) throw new NotFoundException(`Attempt ${attemptId} not found`);
    if (attempt.employeeId !== employeeId) throw new ForbiddenException();
    if (attempt.status !== 'in_progress') {
      throw new BadRequestException('Attempt is not in progress');
    }

    // Агрегируем баллы по компетенциям
    type CompEntry = {
      competencyId: string;
      minGrade: string;
      score: number;
      max: number;
    };
    const compMap = new Map<string, CompEntry>();

    let totalScore = 0;
    let totalMax = 0;

    for (const log of attempt.answerLogs) {
      const logScore = Number(log.score ?? log.llmScore ?? 0);
      const logMax = Number(log.question.maxScore);

      totalScore += logScore;
      totalMax += logMax;

      const { competencyId, minGrade } = log.question.competency;
      if (!compMap.has(competencyId)) {
        compMap.set(competencyId, { competencyId, minGrade, score: 0, max: 0 });
      }
      const entry = compMap.get(competencyId)!;
      entry.score += logScore;
      entry.max += logMax;
    }

    const overallGrade = this.calculateGrade(totalScore, totalMax);

    // Формируем данные для CompetencyResult и CompetencyGap
    const resultsData: {
      attemptId: string;
      competencyId: string;
      score: number;
      maxScore: number;
      gradeAchieved: string;
    }[] = [];

    const gapsData: {
      attemptId: string;
      competencyId: string;
      actualGrade: string;
      targetGrade: string;
    }[] = [];

    for (const { competencyId, minGrade, score, max } of compMap.values()) {
      const gradeAchieved = this.calculateGrade(score, max);

      resultsData.push({
        attemptId,
        competencyId,
        score,
        maxScore: max,
        gradeAchieved,
      });

      // Разрыв компетенции: фактический грейд ниже минимально требуемого
      if (GRADE_ORDER[gradeAchieved] < GRADE_ORDER[minGrade]) {
        gapsData.push({
          attemptId,
          competencyId,
          actualGrade: gradeAchieved,
          targetGrade: minGrade,
        });
      }
    }

    // Транзакция (NFR-17): update + createMany CompetencyResult + createMany CompetencyGap
    const result = await this.prisma.$transaction(async (tx) => {
      const updatedAttempt = await tx.testAttempt.update({
        where: { attemptId },
        data: {
          status: 'completed',
          finishedAt: new Date(),
          totalScore,
          maxScore: totalMax,
          gradeAchieved: overallGrade as any,
        },
        include: { test: true },
      });

      await tx.competencyResult.createMany({
        data: resultsData as any,
        skipDuplicates: true,
      });

      if (gapsData.length > 0) {
        await tx.competencyGap.createMany({
          data: gapsData as any,
          skipDuplicates: true,
        });
      }

      return {
        attemptId: updatedAttempt.attemptId,
        status: updatedAttempt.status,
        gradeAchieved: updatedAttempt.gradeAchieved,
        totalScore,
        maxScore: totalMax,
        finishedAt: updatedAttempt.finishedAt,
        competencyResultsCount: resultsData.length,
        competencyGapsCount: gapsData.length,
        competencyResults: resultsData,
        competencyGaps: gapsData,
      };
    });

    return result;
  }

  /**
   * UC-01: выдать следующий вопрос по текущему индексу попытки.
   * isCorrect намеренно исключён из вариантов ответа.
   */
  async nextQuestion(attemptId: string, employeeId: string) {
    const attempt = await this.prisma.testAttempt.findUnique({
      where: { attemptId },
      include: {
        test: {
          include: {
            testQuestions: {
              orderBy: { orderNumber: 'asc' },
              include: {
                question: {
                  include: {
                    answerOptions: { orderBy: { orderNumber: 'asc' } },
                  },
                },
              },
            },
          },
        },
      },
    });

    if (!attempt) throw new NotFoundException(`Attempt ${attemptId} not found`);
    if (attempt.employeeId !== employeeId) throw new ForbiddenException();
    if (attempt.status !== 'in_progress') {
      throw new BadRequestException('Attempt is not in progress');
    }

    const questions = attempt.test.testQuestions;
    const currentIndex = attempt.currentQuestionIndex;
    const total = questions.length;

    if (currentIndex >= total) {
      return { done: true, current_index: currentIndex, total_questions: total };
    }

    const { question } = questions[currentIndex];

    // Убираем isCorrect — сотрудник не должен видеть правильный ответ
    const answerOptions = question.answerOptions.map(
      ({ isCorrect: _ic, ...opt }) => opt,
    );

    return {
      done: false,
      attempt_id: attemptId,
      current_index: currentIndex,
      total_questions: total,
      question: {
        question_id: question.questionId,
        text: question.text,
        type: question.type,
        difficulty: question.difficulty,
        max_score: question.maxScore,
        answer_options: answerOptions,
      },
    };
  }

  /**
   * Пороги грейдов по ВКР гл. 2:
   * К1 0–20% | К2 21–40% | К3 41–60% | К4 61–80% | К5 81–100%
   */
  private calculateGrade(score: number, max: number): 'K1' | 'K2' | 'K3' | 'K4' | 'K5' {
    if (max === 0) return 'K1';
    const pct = (score / max) * 100;
    if (pct > 80) return 'K5';
    if (pct > 60) return 'K4';
    if (pct > 40) return 'K3';
    if (pct > 20) return 'K2';
    return 'K1';
  }
}
