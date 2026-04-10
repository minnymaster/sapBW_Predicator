import { Injectable } from '@nestjs/common';
import { InjectQueue } from '@nestjs/bull';
import { Queue } from 'bull';
import { LLM_QUEUE, LLM_JOB, LLM_JOB_OPTIONS } from './llm-queue.constants';
import { GeneratedQuestion, GapInfo } from './llm.service';
import {
  EvaluateOpenAnswerData,
  GenerateQuestionsData,
  GenerateDistractorsData,
  GenerateRecommendationData,
} from './llm.processor';

/**
 * LlmQueueService — публичный фасад для постановки LLM-задач в очередь.
 *
 * Два режима:
 *  - fire-and-forget (evaluateOpenAnswer): добавляет джоб и немедленно возвращает.
 *  - awaited      (остальные три метода): добавляет джоб и ждёт результата
 *    через job.finished(), который резолвится в возвращаемое значение обработчика.
 *
 * Retry и timeout настроены в LLM_JOB_OPTIONS (llm-queue.constants.ts).
 */
@Injectable()
export class LlmQueueService {
  constructor(@InjectQueue(LLM_QUEUE) private readonly queue: Queue) {}

  /**
   * Асинхронная оценка развёрнутого ответа (open_text / short_answer).
   * Fire-and-forget: AnswerLog обновляется процессором после получения результата.
   * Вызывается из AttemptsService.submitAnswer — не блокирует HTTP-ответ.
   */
  async evaluateOpenAnswer(
    logId: string,
    question: string,
    answer: string,
    employeeId?: string,
  ): Promise<void> {
    const data: EvaluateOpenAnswerData = { logId, question, answer, employeeId };
    await this.queue.add(LLM_JOB.EVALUATE_OPEN_ANSWER, data, LLM_JOB_OPTIONS);
  }

  /**
   * Генерация вопросов для компетенции и грейда (UC-08).
   * Ожидает завершения через job.finished() — вызывающий код получает результат.
   */
  async generateQuestions(
    competency: { name: string; area: string; description?: string; type?: string },
    grade: string,
    count: number,
    employeeId?: string,
  ): Promise<GeneratedQuestion[]> {
    const data: GenerateQuestionsData = { competency, grade, count, employeeId };
    const job = await this.queue.add(LLM_JOB.GENERATE_QUESTIONS, data, LLM_JOB_OPTIONS);
    return job.finished() as Promise<GeneratedQuestion[]>;
  }

  /**
   * Генерация дистракторов (неверных вариантов ответа).
   * Ожидает завершения через job.finished().
   */
  async generateDistractors(
    question: string,
    correctAnswer: string,
    employeeId?: string,
  ): Promise<string[]> {
    const data: GenerateDistractorsData = { question, correctAnswer, employeeId };
    const job = await this.queue.add(LLM_JOB.GENERATE_DISTRACTORS, data, LLM_JOB_OPTIONS);
    return job.finished() as Promise<string[]>;
  }

  /**
   * Генерация персонализированного плана развития (UC-04).
   * Ожидает завершения через job.finished().
   */
  async generateRecommendation(
    gaps: GapInfo[],
    employeeId?: string,
  ): Promise<string> {
    const data: GenerateRecommendationData = { gaps, employeeId };
    const job = await this.queue.add(LLM_JOB.GENERATE_RECOMMENDATION, data, LLM_JOB_OPTIONS);
    return job.finished() as Promise<string>;
  }
}
