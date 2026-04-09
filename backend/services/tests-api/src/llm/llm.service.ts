import { Injectable, Logger, ServiceUnavailableException } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';

// ---------------------------------------------------------------------------
// PROMPT CONSTANTS (требование CLAUDE.md: явная документация промптов)
// ---------------------------------------------------------------------------

/**
 * PROMPT_GENERATE_QUESTIONS
 * Используется в: QuestionsService.generateViaLlm
 * Модель: Llama-3.1-70B (или Groq llama-3.1-70b-versatile)
 */
const PROMPT_GENERATE_QUESTIONS = (params: {
  competencyName: string;
  competencyArea: string;
  difficulty: string;
  type: string;
  count: number;
}) => `You are an expert SAP BW certification question author.
Generate exactly ${params.count} assessment question(s) for SAP BW competency:
- Competency: ${params.competencyName}
- Area: ${params.competencyArea}
- Difficulty: ${params.difficulty}
- Type: ${params.type}

Rules:
1. For single_choice/multiple_choice — provide 4 answer options, mark correct ones.
2. For short_answer — provide a model answer in the explanation field.
3. For open_text — provide evaluation criteria in the explanation field.
4. Questions must be in Russian.
5. Respond ONLY with a valid JSON array, no markdown.

JSON schema per question:
{
  "text": "string",
  "explanation": "string",
  "answerOptions": [{ "text": "string", "isCorrect": boolean, "orderNumber": number }]
}`;

/**
 * PROMPT_SCORE_OPEN_ANSWER
 * Используется в: AttemptsService.submitAnswer (open_text вопросы)
 */
const PROMPT_SCORE_OPEN_ANSWER = (params: {
  questionText: string;
  answerText: string;
  explanation: string;
}) => `You are an SAP BW expert evaluating a candidate's open-text answer.

Question: ${params.questionText}
Expected criteria: ${params.explanation}
Candidate's answer: ${params.answerText}

Score the answer from 0.0 to 1.0 (float) and provide a brief explanation in Russian.
Respond ONLY with valid JSON: { "score": number, "explanation": "string" }`;

/**
 * PROMPT_RECOMMENDATIONS
 * Используется в: RecommendationsService.generateForAttempt
 */
const PROMPT_RECOMMENDATIONS = (params: {
  gaps: Array<{
    competencyName: string;
    competencyArea: string;
    actualGrade: string;
    targetGrade: string;
  }>;
}) => `You are an SAP BW learning advisor. Based on competency gaps, recommend courses.

Gaps:
${params.gaps
  .map(
    (g, i) =>
      `${i + 1}. ${g.competencyName} (${g.competencyArea}): current ${g.actualGrade} → target ${g.targetGrade}`,
  )
  .join('\n')}

For each gap provide ONE course recommendation.
Use realistic SAP Learning Hub or openSAP course names.
Respond ONLY with valid JSON array:
[{
  "gapIndex": number,
  "courseTitle": "string",
  "explanation": "string (in Russian)",
  "priority": number (1 = highest)
}]`;

// ---------------------------------------------------------------------------

interface GeneratedQuestion {
  text: string;
  explanation?: string;
  answerOptions?: Array<{ text: string; isCorrect: boolean; orderNumber: number }>;
}

interface ScoreResult {
  score: number;
  explanation: string;
}

interface RecommendationResult {
  gapId: string;
  courseId: string;
  courseTitle: string;
  priority: number;
  explanation: string;
}

@Injectable()
export class LlmService {
  private readonly logger = new Logger(LlmService.name);
  private readonly baseUrl: string;
  private readonly apiKey: string;
  private readonly model: string;
  private readonly timeoutMs: number;

  constructor(private readonly cfg: ConfigService) {
    this.baseUrl = cfg.get<string>('LLM_BASE_URL', 'https://api.groq.com/openai/v1');
    // GROQ_API_KEY — официальный env-var Groq SDK; LLM_API_KEY — общий fallback
    this.apiKey =
      cfg.get<string>('GROQ_API_KEY') ??
      cfg.get<string>('LLM_API_KEY', '');
    this.model = cfg.get<string>('LLM_MODEL', 'llama-3.1-70b-versatile');
    this.timeoutMs = cfg.get<number>('LLM_TIMEOUT_MS', 30000);
  }

  async generateQuestions(params: Parameters<typeof PROMPT_GENERATE_QUESTIONS>[0]): Promise<GeneratedQuestion[]> {
    const prompt = PROMPT_GENERATE_QUESTIONS(params);
    const raw = await this.chat(prompt);
    try {
      return JSON.parse(raw) as GeneratedQuestion[];
    } catch {
      this.logger.error('LLM returned invalid JSON for generateQuestions', raw);
      throw new ServiceUnavailableException('LLM response parsing failed');
    }
  }

  async scoreOpenAnswer(params: Parameters<typeof PROMPT_SCORE_OPEN_ANSWER>[0]): Promise<ScoreResult> {
    const prompt = PROMPT_SCORE_OPEN_ANSWER(params);
    const raw = await this.chat(prompt);
    try {
      return JSON.parse(raw) as ScoreResult;
    } catch {
      this.logger.error('LLM returned invalid JSON for scoreOpenAnswer', raw);
      return { score: 0, explanation: 'Ошибка парсинга ответа LLM' };
    }
  }

  async generateRecommendations(
    params: Parameters<typeof PROMPT_RECOMMENDATIONS>[0] & {
      gapIds?: string[];
    },
  ): Promise<RecommendationResult[]> {
    const prompt = PROMPT_RECOMMENDATIONS(params);
    const raw = await this.chat(prompt);
    try {
      const items = JSON.parse(raw) as Array<{
        gapIndex: number;
        courseTitle: string;
        explanation: string;
        priority: number;
      }>;
      return items.map((item) => ({
        gapId: params.gapIds?.[item.gapIndex - 1] ?? '',
        courseId: `llm-${Date.now()}-${item.gapIndex}`,
        courseTitle: item.courseTitle,
        priority: item.priority,
        explanation: item.explanation,
      }));
    } catch {
      this.logger.error('LLM returned invalid JSON for generateRecommendations', raw);
      throw new ServiceUnavailableException('LLM response parsing failed');
    }
  }

  private async chat(prompt: string): Promise<string> {
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), this.timeoutMs);

    try {
      const res = await fetch(`${this.baseUrl}/chat/completions`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${this.apiKey}`,
        },
        body: JSON.stringify({
          model: this.model,
          messages: [{ role: 'user', content: prompt }],
          temperature: 0.3,
          max_tokens: 2048,
        }),
        signal: controller.signal,
      });

      if (!res.ok) {
        throw new ServiceUnavailableException(`LLM API error ${res.status}`);
      }

      const json = (await res.json()) as {
        choices: Array<{ message: { content: string } }>;
      };
      return json.choices[0]?.message?.content ?? '';
    } catch (err) {
      if ((err as Error).name === 'AbortError') {
        throw new ServiceUnavailableException('LLM request timed out');
      }
      throw err;
    } finally {
      clearTimeout(timer);
    }
  }
}
