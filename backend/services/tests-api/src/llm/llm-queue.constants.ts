import { JobOptions } from 'bull';

/** Имя очереди Redis */
export const LLM_QUEUE = 'llm-queue';

/** Имена джобов — строго типизированный enum-объект */
export const LLM_JOB = {
  EVALUATE_OPEN_ANSWER: 'evaluate-open-answer',
  GENERATE_QUESTIONS:   'generate-questions',
  GENERATE_DISTRACTORS: 'generate-distractors',
  GENERATE_RECOMMENDATION: 'generate-recommendation',
} as const;

export type LlmJobName = typeof LLM_JOB[keyof typeof LLM_JOB];

/**
 * Общие опции для всех LLM-джобов:
 *  - attempts: 3 попытки (NFR-17: устойчивость к временным сбоям LLM)
 *  - backoff: exponential — 2 с → 4 с → 8 с
 *  - timeout: 30 000 мс — жёсткий таймаут джоба на уровне Bull
 *  - removeOnComplete/Fail: хранить последние 100/50 джобов для аудита (NFR-09)
 */
export const LLM_JOB_OPTIONS: JobOptions = {
  attempts: 3,
  backoff: { type: 'exponential', delay: 2_000 },
  timeout: 30_000,
  removeOnComplete: 100,
  removeOnFail: 50,
};
