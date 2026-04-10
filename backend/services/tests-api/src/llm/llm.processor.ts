import { Logger } from '@nestjs/common';
import {
  Processor, Process, OnQueueFailed, OnQueueCompleted, OnQueueActive,
} from '@nestjs/bull';
import { Job } from 'bull';
import { LlmService, GeneratedQuestion, GapInfo } from './llm.service';
import { PrismaService } from '../prisma/prisma.service';
import { LLM_QUEUE, LLM_JOB } from './llm-queue.constants';

// ---------------------------------------------------------------------------
// Типы данных джобов (должны совпадать с LlmQueueService)
// ---------------------------------------------------------------------------

export interface EvaluateOpenAnswerData {
  logId: string;          // BigInt → string для JSON-сериализации
  question: string;
  answer: string;
  employeeId?: string;    // для NFR-09 аудит-лога
}

export interface GenerateQuestionsData {
  competency: { name: string; area: string; description?: string; type?: string };
  grade: string;
  count: number;
  employeeId?: string;
}

export interface GenerateDistractorsData {
  question: string;
  correctAnswer: string;
  employeeId?: string;
}

export interface GenerateRecommendationData {
  gaps: GapInfo[];
  employeeId?: string;
}

// ---------------------------------------------------------------------------
// Хелпер: анонимизация employee_id для NFR-09
// Берём первые 8 символов UUID без дефисов — псевдоним для аудита,
// не позволяет восстановить исходный ID без дополнительного контекста.
// ---------------------------------------------------------------------------
function anonymize(id?: string): string {
  if (!id) return 'anon';
  return id.replace(/-/g, '').slice(0, 8);
}

// ---------------------------------------------------------------------------
// Processor
// ---------------------------------------------------------------------------

@Processor(LLM_QUEUE)
export class LlmProcessor {
  private readonly logger = new Logger(LlmProcessor.name);

  constructor(
    private readonly llm: LlmService,
    private readonly prisma: PrismaService,
  ) {}

  // ── NFR-09: аудит-лог каждого вызова ──────────────────────────────────────

  @OnQueueActive()
  onActive(job: Job): void {
    const emp = anonymize((job.data as { employeeId?: string }).employeeId);
    this.logger.log(
      `[${new Date().toISOString()}] START job=${job.name} id=${job.id} emp=${emp}`,
    );
  }

  @OnQueueCompleted()
  onCompleted(job: Job): void {
    const emp = anonymize((job.data as { employeeId?: string }).employeeId);
    this.logger.log(
      `[${new Date().toISOString()}] DONE  job=${job.name} id=${job.id} emp=${emp} attempts=${job.attemptsMade}`,
    );
  }

  @OnQueueFailed()
  onFailed(job: Job, err: Error): void {
    const emp = anonymize((job.data as { employeeId?: string }).employeeId);
    this.logger.error(
      `[${new Date().toISOString()}] FAIL  job=${job.name} id=${job.id} emp=${emp} attempt=${job.attemptsMade}/${job.opts.attempts} err="${err.message}"`,
    );
  }

  // ── Обработчики джобов ────────────────────────────────────────────────────

  /**
   * evaluate-open-answer
   * Fire-and-forget: оценивает развёрнутый ответ и обновляет AnswerLog.
   * Повторные попытки (до 3) + exponential backoff — см. LLM_JOB_OPTIONS.
   * PROMPT_EVALUATE_ANSWER — см. llm.service.ts
   */
  @Process(LLM_JOB.EVALUATE_OPEN_ANSWER)
  async handleEvaluateOpenAnswer(job: Job<EvaluateOpenAnswerData>): Promise<void> {
    const { logId, question, answer } = job.data;
    const result = await this.llm.evaluateOpenAnswer(question, answer);

    await this.prisma.answerLog.update({
      where: { logId: BigInt(logId) },
      data: { llmScore: result.score, llmExplanation: result.explanation },
    });
  }

  /**
   * generate-questions
   * Генерирует вопросы по компетенции и грейду (UC-08).
   * Результат возвращается через job.finished() в LlmQueueService.
   * PROMPT_GENERATE_QUESTIONS — см. llm.service.ts
   */
  @Process(LLM_JOB.GENERATE_QUESTIONS)
  async handleGenerateQuestions(
    job: Job<GenerateQuestionsData>,
  ): Promise<GeneratedQuestion[]> {
    const { competency, grade, count } = job.data;
    return this.llm.generateQuestions(competency, grade, count);
  }

  /**
   * generate-distractors
   * Генерирует неверные варианты ответа для закрытого вопроса.
   * Результат возвращается через job.finished().
   * PROMPT_GENERATE_DISTRACTORS — см. llm.service.ts
   */
  @Process(LLM_JOB.GENERATE_DISTRACTORS)
  async handleGenerateDistractors(
    job: Job<GenerateDistractorsData>,
  ): Promise<string[]> {
    const { question, correctAnswer } = job.data;
    return this.llm.generateDistractors(question, correctAnswer);
  }

  /**
   * generate-recommendation
   * Генерирует персонализированный план развития (UC-04).
   * Результат возвращается через job.finished().
   * PROMPT_GENERATE_RECOMMENDATION — см. llm.service.ts
   */
  @Process(LLM_JOB.GENERATE_RECOMMENDATION)
  async handleGenerateRecommendation(
    job: Job<GenerateRecommendationData>,
  ): Promise<string> {
    const { gaps } = job.data;
    return this.llm.generateRecommendation(gaps);
  }
}
