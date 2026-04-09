import {
  BadRequestException, Injectable, NotFoundException, ForbiddenException,
} from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { LlmService } from '../llm/llm.service';
import { SubmitAnswerDto } from './dto/submit-answer.dto';

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

  /** UC-02: сохранить ответ на вопрос */
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

    if (['single_choice', 'multiple_choice'].includes(question.type)) {
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

    return log;
  }

  /**
   * UC-03: завершить тест, посчитать грейд, сгенерировать рекомендации
   */
  async finish(attemptId: string, employeeId: string) {
    const attempt = await this.findOne(attemptId);
    if (attempt.employeeId !== employeeId) throw new ForbiddenException();
    if (attempt.status !== 'in_progress') {
      throw new BadRequestException('Attempt is not in progress');
    }

    // Считаем баллы
    const logs = attempt.answerLogs;
    const total = logs.reduce((s, l) => s + (Number(l.score ?? l.llmScore ?? 0)), 0);
    const max = logs.length; // упрощённо; точный расчёт через question.maxScore

    const gradeAchieved = this.calculateGrade(total, max);

    const updated = await this.prisma.testAttempt.update({
      where: { attemptId },
      data: {
        status: 'completed',
        finishedAt: new Date(),
        totalScore: total,
        maxScore: max,
        gradeAchieved,
      },
      include: { test: true },
    });

    return updated;
  }

  private calculateGrade(score: number, max: number): 'K1' | 'K2' | 'K3' | 'K4' | 'K5' {
    if (max === 0) return 'K1';
    const pct = (score / max) * 100;
    if (pct >= 90) return 'K5';
    if (pct >= 75) return 'K4';
    if (pct >= 60) return 'K3';
    if (pct >= 40) return 'K2';
    return 'K1';
  }
}
