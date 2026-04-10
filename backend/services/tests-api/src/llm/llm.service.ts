import { Injectable, Logger, ServiceUnavailableException } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import Groq from 'groq-sdk';

// =============================================================================
// ТИПЫ
// =============================================================================

export interface GeneratedQuestion {
  text: string;
  explanation?: string;
  answerOptions?: Array<{ text: string; isCorrect: boolean; orderNumber: number }>;
}

export interface GapInfo {
  competencyName: string;
  competencyArea: string;
  actualGrade: string;
  targetGrade: string;
}

// =============================================================================
// PROMPT CONSTANTS
// Требование CLAUDE.md: каждый промпт явно задокументирован как константа.
// =============================================================================

/**
 * PROMPT_EVALUATE_ANSWER
 * Используется в: AttemptsService.submitAnswer (вопросы типа open_text / short_answer)
 * Вход: текст вопроса, ответ кандидата
 * Выход: JSON { score: 0.0–1.0, explanation: string (RU) }
 */
const PROMPT_EVALUATE_ANSWER = (question: string, answer: string) =>
  `You are an SAP BW expert evaluating a candidate's written answer.

Question:
${question}

Candidate's answer:
${answer}

Score the answer from 0.0 to 1.0 (float, two decimal places).
Provide a brief explanation in Russian why this score was given.
Respond ONLY with valid JSON, no markdown:
{ "score": number, "explanation": "string" }`;

/**
 * PROMPT_GENERATE_QUESTIONS
 * Используется в: QuestionsService.generateViaLlm (UC-08)
 * Вход: компетенция (name, area), целевой грейд K1–K5, количество вопросов, тип вопроса
 * Выход: JSON array GeneratedQuestion[]
 *
 * Соответствие грейдов уровню сложности:
 *   K1 — базовые понятия и терминология
 *   K2 — стандартные задачи под руководством
 *   K3 — самостоятельное решение типовых задач
 *   K4 — сложные сценарии и оптимизация
 *   K5 — архитектурные решения, экспертный уровень
 */
const PROMPT_GENERATE_QUESTIONS = (
  competency: { name: string; area: string; description?: string; type?: string },
  grade: string,
  count: number,
) => {
  const gradeDesc: Record<string, string> = {
    K1: 'basic concepts and terminology (beginner)',
    K2: 'standard guided tasks (junior)',
    K3: 'independent standard problem-solving (middle)',
    K4: 'complex scenarios and optimization (senior)',
    K5: 'architectural decisions and expert-level analysis (architect/PM)',
  };
  const levelHint = gradeDesc[grade] ?? 'intermediate level';
  const typeHint = competency.type ? `Question type: ${competency.type}.` : 'Use mixed question types.';

  return `You are an expert SAP BW certification question author.
Generate exactly ${count} assessment question(s) for the following SAP BW competency:

Competency: ${competency.name}
Area: ${competency.area}${competency.description ? `\nDescription: ${competency.description}` : ''}
Target grade: ${grade} — ${levelHint}
${typeHint}

Rules:
1. For single_choice / multiple_choice — provide exactly 4 answer options, mark correct ones with isCorrect: true.
2. For short_answer — provide a model answer and evaluation criteria in the explanation field.
3. For open_text — provide evaluation criteria in the explanation field.
4. All question texts and explanations must be in Russian.
5. Respond ONLY with a valid JSON array, no markdown, no prose.

JSON schema (one object per question):
[{
  "text": "string",
  "explanation": "string",
  "answerOptions": [{ "text": "string", "isCorrect": boolean, "orderNumber": number }]
}]`;
};

/**
 * PROMPT_GENERATE_DISTRACTORS
 * Используется в: QuestionsService — генерация дистракторов для закрытых вопросов
 * Вход: текст вопроса, правильный ответ
 * Выход: JSON array из 3 строк — правдоподобных, но неверных вариантов ответа
 */
const PROMPT_GENERATE_DISTRACTORS = (question: string, correctAnswer: string) =>
  `You are an SAP BW expert creating plausible but incorrect answer options (distractors) for a multiple-choice question.

Question: ${question}
Correct answer: ${correctAnswer}

Generate exactly 3 distractors in Russian.
Each distractor must be:
- plausible and related to SAP BW concepts
- clearly wrong compared to the correct answer
- distinct from each other

Respond ONLY with a valid JSON array of strings, no markdown:
["distractor 1", "distractor 2", "distractor 3"]`;

/**
 * PROMPT_GENERATE_RECOMMENDATION
 * Используется в: RecommendationsService.generateForAttempt (UC-03, UC-04)
 * Вход: массив компетентностных разрывов (actualGrade < targetGrade)
 * Выход: персонализированный план развития в виде markdown-строки (RU)
 */
const PROMPT_GENERATE_RECOMMENDATION = (gaps: GapInfo[]) =>
  `You are an SAP BW learning advisor. A candidate has the following competency gaps after testing:

${gaps
  .map(
    (g, i) =>
      `${i + 1}. ${g.competencyName} (area: ${g.competencyArea})\n   Current grade: ${g.actualGrade} → Target: ${g.targetGrade}`,
  )
  .join('\n\n')}

Write a concise personalised learning plan in Russian (200–400 words).
For each gap mention:
- what skills to develop
- 1–2 specific SAP Learning Hub or openSAP course names
- approximate time to reach the target grade

Format the response as readable markdown (use headers and bullet points).
Do NOT output JSON.`;

// =============================================================================
// SERVICE
// =============================================================================

@Injectable()
export class LlmService {
  private readonly logger = new Logger(LlmService.name);
  private readonly groq: Groq;
  private readonly model: string;

  constructor(private readonly cfg: ConfigService) {
    this.groq = new Groq({
      apiKey: cfg.get<string>('GROQ_API_KEY', ''),
    });
    // Llama-3.1-70B согласно CLAUDE.md; можно переопределить через LLM_MODEL
    this.model = cfg.get<string>('LLM_MODEL', 'llama-3.1-70b-versatile');
  }

  // ---------------------------------------------------------------------------
  // Публичные методы
  // ---------------------------------------------------------------------------

  /**
   * Оценка развёрнутого ответа (open_text / short_answer).
   * Вызывается из AttemptsService.submitAnswer асинхронно.
   */
  async evaluateOpenAnswer(
    question: string,
    answer: string,
  ): Promise<{ score: number; explanation: string }> {
    const prompt = PROMPT_EVALUATE_ANSWER(question, answer);
    const raw = await this.chat(prompt, 512);
    try {
      const parsed = JSON.parse(raw) as { score: number; explanation: string };
      return { score: Math.min(1, Math.max(0, parsed.score)), explanation: parsed.explanation };
    } catch {
      this.logger.error('LLM: invalid JSON from evaluateOpenAnswer', raw);
      return { score: 0, explanation: 'Ошибка разбора ответа LLM' };
    }
  }

  /**
   * Генерация вопросов для заданной компетенции и грейда (UC-08).
   * Вызывается из QuestionsService.generateViaLlm.
   */
  async generateQuestions(
    competency: { name: string; area: string; description?: string; type?: string },
    grade: string,
    count: number,
  ): Promise<GeneratedQuestion[]> {
    const prompt = PROMPT_GENERATE_QUESTIONS(competency, grade, count);
    const raw = await this.chat(prompt, 4096);
    try {
      return JSON.parse(raw) as GeneratedQuestion[];
    } catch {
      this.logger.error('LLM: invalid JSON from generateQuestions', raw);
      throw new ServiceUnavailableException('LLM response parsing failed');
    }
  }

  /**
   * Генерация дистракторов (неверных вариантов) для закрытого вопроса.
   * Вызывается из QuestionsService при добавлении вариантов ответа.
   */
  async generateDistractors(
    question: string,
    correctAnswer: string,
  ): Promise<string[]> {
    const prompt = PROMPT_GENERATE_DISTRACTORS(question, correctAnswer);
    const raw = await this.chat(prompt, 512);
    try {
      const parsed = JSON.parse(raw) as string[];
      if (!Array.isArray(parsed)) throw new Error('not array');
      return parsed;
    } catch {
      this.logger.error('LLM: invalid JSON from generateDistractors', raw);
      throw new ServiceUnavailableException('LLM response parsing failed');
    }
  }

  /**
   * Персонализированный план развития по компетентностным разрывам (UC-04).
   * Вызывается из RecommendationsService.generateForAttempt.
   * Возвращает markdown-строку на русском языке.
   */
  async generateRecommendation(gaps: GapInfo[]): Promise<string> {
    const prompt = PROMPT_GENERATE_RECOMMENDATION(gaps);
    const raw = await this.chat(prompt, 1024);
    return raw.trim();
  }

  // ---------------------------------------------------------------------------
  // Приватный метод — вызов Groq Chat API
  // ---------------------------------------------------------------------------

  private async chat(prompt: string, maxTokens = 2048): Promise<string> {
    const timeoutMs = this.cfg.get<number>('LLM_TIMEOUT_MS', 30000);

    try {
      const completion = await this.groq.chat.completions.create(
        {
          model: this.model,
          messages: [{ role: 'user', content: prompt }],
          temperature: 0.3,
          max_tokens: maxTokens,
        },
        { timeout: timeoutMs },
      );
      return completion.choices[0]?.message?.content ?? '';
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : String(err);
      this.logger.error(`Groq API error: ${msg}`);
      throw new ServiceUnavailableException(`LLM unavailable: ${msg}`);
    }
  }
}
