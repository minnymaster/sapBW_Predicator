import { Test, TestingModule } from '@nestjs/testing';
import { ConfigService } from '@nestjs/config';
import { ServiceUnavailableException } from '@nestjs/common';
import { LlmService, GapInfo } from './llm.service';

// ---------------------------------------------------------------------------
// Groq SDK mock
// Variables starting with "mock" are hoisted by Jest's transform so they can
// be safely referenced inside jest.mock() factory closures.
// ---------------------------------------------------------------------------
const mockCreate = jest.fn();

jest.mock('groq-sdk', () => ({
  __esModule: true,
  default: jest.fn().mockImplementation(() => ({
    chat: {
      completions: {
        create: mockCreate,
      },
    },
  })),
}));

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

const makeCompletion = (content: string) => ({
  choices: [{ message: { content } }],
});

const mockConfigService = {
  get: (key: string, def?: unknown) => {
    const map: Record<string, unknown> = {
      GROQ_API_KEY: 'test-key',
      LLM_MODEL: 'llama-3.1-70b-versatile',
      LLM_TIMEOUT_MS: 30000,
    };
    return map[key] ?? def;
  },
};

// ---------------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------------

describe('LlmService', () => {
  let service: LlmService;

  beforeEach(async () => {
    mockCreate.mockReset();

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        LlmService,
        { provide: ConfigService, useValue: mockConfigService },
      ],
    }).compile();

    service = module.get(LlmService);
  });

  // -------------------------------------------------------------------------
  // evaluateOpenAnswer
  // -------------------------------------------------------------------------

  describe('evaluateOpenAnswer', () => {
    it('returns parsed score and explanation from valid JSON', async () => {
      mockCreate.mockResolvedValueOnce(
        makeCompletion('{"score": 0.85, "explanation": "Хороший ответ"}'),
      );

      const result = await service.evaluateOpenAnswer(
        'Что такое InfoCube в SAP BW?',
        'InfoCube — многомерная структура данных в SAP BW для хранения аналитических данных',
      );

      expect(result.score).toBe(0.85);
      expect(result.explanation).toBe('Хороший ответ');
      expect(mockCreate).toHaveBeenCalledTimes(1);
    });

    it('passes question and answer text in the prompt', async () => {
      mockCreate.mockResolvedValueOnce(makeCompletion('{"score": 0.5, "explanation": "Частично"}'));

      await service.evaluateOpenAnswer('Вопрос SAP BW', 'Ответ кандидата');

      const prompt: string = mockCreate.mock.calls[0][0].messages[0].content;
      expect(prompt).toContain('Вопрос SAP BW');
      expect(prompt).toContain('Ответ кандидата');
    });

    it('clamps score above 1.0 to exactly 1.0', async () => {
      mockCreate.mockResolvedValueOnce(
        makeCompletion('{"score": 1.5, "explanation": "Выше максимума"}'),
      );

      const result = await service.evaluateOpenAnswer('q', 'a');
      expect(result.score).toBe(1);
    });

    it('clamps negative score to 0', async () => {
      mockCreate.mockResolvedValueOnce(
        makeCompletion('{"score": -0.3, "explanation": "Отрицательный"}'),
      );

      const result = await service.evaluateOpenAnswer('q', 'a');
      expect(result.score).toBe(0);
    });

    it('returns score=0 and fallback explanation on invalid JSON', async () => {
      mockCreate.mockResolvedValueOnce(makeCompletion('not valid json at all'));

      const result = await service.evaluateOpenAnswer('q', 'a');

      expect(result.score).toBe(0);
      expect(result.explanation).toBe('Ошибка разбора ответа LLM');
    });

    it('throws ServiceUnavailableException when Groq API rejects', async () => {
      mockCreate.mockRejectedValueOnce(new Error('network timeout'));

      await expect(service.evaluateOpenAnswer('q', 'a')).rejects.toThrow(
        ServiceUnavailableException,
      );
    });

    it('uses max_tokens=512', async () => {
      mockCreate.mockResolvedValueOnce(makeCompletion('{"score": 0.7, "explanation": "Ok"}'));

      await service.evaluateOpenAnswer('q', 'a');

      expect(mockCreate.mock.calls[0][0].max_tokens).toBe(512);
    });
  });

  // -------------------------------------------------------------------------
  // generateQuestions
  // -------------------------------------------------------------------------

  describe('generateQuestions', () => {
    const competency = { name: 'Моделирование данных', area: 'data_modeling' };

    it('returns parsed GeneratedQuestion array on success', async () => {
      const questions = [
        {
          text: 'Что такое InfoCube?',
          explanation: 'Многомерная структура данных',
          answerOptions: [
            { text: 'Многомерная структура', isCorrect: true, orderNumber: 0 },
            { text: 'Плоская таблица', isCorrect: false, orderNumber: 1 },
          ],
        },
      ];
      mockCreate.mockResolvedValueOnce(makeCompletion(JSON.stringify(questions)));

      const result = await service.generateQuestions(competency, 'K2', 1);

      expect(result).toHaveLength(1);
      expect(result[0].text).toBe('Что такое InfoCube?');
      expect(result[0].answerOptions).toHaveLength(2);
    });

    it('includes competency name, area, and grade in the prompt', async () => {
      mockCreate.mockResolvedValueOnce(makeCompletion('[]'));

      await service.generateQuestions({ name: 'ABAP', area: 'abap' }, 'K4', 3);

      const prompt: string = mockCreate.mock.calls[0][0].messages[0].content;
      expect(prompt).toContain('ABAP');
      expect(prompt).toContain('abap');
      expect(prompt).toContain('K4');
      expect(prompt).toContain('3');
    });

    it('uses max_tokens=4096', async () => {
      mockCreate.mockResolvedValueOnce(makeCompletion('[]'));
      await service.generateQuestions(competency, 'K1', 1);
      expect(mockCreate.mock.calls[0][0].max_tokens).toBe(4096);
    });

    it('throws ServiceUnavailableException on invalid JSON', async () => {
      mockCreate.mockResolvedValueOnce(makeCompletion('{bad json'));

      await expect(service.generateQuestions(competency, 'K2', 1)).rejects.toThrow(
        ServiceUnavailableException,
      );
    });

    it('throws ServiceUnavailableException when Groq API rejects', async () => {
      mockCreate.mockRejectedValueOnce(new Error('API error'));

      await expect(service.generateQuestions(competency, 'K3', 2)).rejects.toThrow(
        ServiceUnavailableException,
      );
    });
  });

  // -------------------------------------------------------------------------
  // generateDistractors
  // -------------------------------------------------------------------------

  describe('generateDistractors', () => {
    it('returns array of 3 distractor strings', async () => {
      const distractors = ['Вариант 1', 'Вариант 2', 'Вариант 3'];
      mockCreate.mockResolvedValueOnce(makeCompletion(JSON.stringify(distractors)));

      const result = await service.generateDistractors('Что такое DSO?', 'Data Store Object');

      expect(result).toHaveLength(3);
      expect(result).toEqual(distractors);
    });

    it('includes question and correct answer in the prompt', async () => {
      mockCreate.mockResolvedValueOnce(makeCompletion('["a","b","c"]'));

      await service.generateDistractors('Вопрос?', 'Правильный ответ');

      const prompt: string = mockCreate.mock.calls[0][0].messages[0].content;
      expect(prompt).toContain('Вопрос?');
      expect(prompt).toContain('Правильный ответ');
    });

    it('throws ServiceUnavailableException when response is not a JSON array', async () => {
      mockCreate.mockResolvedValueOnce(makeCompletion('{"not": "array"}'));

      await expect(service.generateDistractors('q', 'a')).rejects.toThrow(
        ServiceUnavailableException,
      );
    });

    it('throws ServiceUnavailableException on invalid JSON', async () => {
      mockCreate.mockResolvedValueOnce(makeCompletion('not json'));

      await expect(service.generateDistractors('q', 'a')).rejects.toThrow(
        ServiceUnavailableException,
      );
    });
  });

  // -------------------------------------------------------------------------
  // generateRecommendation
  // -------------------------------------------------------------------------

  describe('generateRecommendation', () => {
    const gaps: GapInfo[] = [
      {
        competencyName: 'Моделирование данных',
        competencyArea: 'data_modeling',
        actualGrade: 'K1',
        targetGrade: 'K3',
      },
    ];

    it('returns trimmed markdown string', async () => {
      const md = '  ## План развития\n- Курс openSAP BW Modeling  ';
      mockCreate.mockResolvedValueOnce(makeCompletion(md));

      const result = await service.generateRecommendation(gaps);

      expect(result).toBe(md.trim());
    });

    it('includes all gap fields in the prompt', async () => {
      const multiGaps: GapInfo[] = [
        { competencyName: 'ABAP', competencyArea: 'abap', actualGrade: 'K2', targetGrade: 'K4' },
        { competencyName: 'BW/4HANA', competencyArea: 'bw4hana', actualGrade: 'K1', targetGrade: 'K5' },
      ];
      mockCreate.mockResolvedValueOnce(makeCompletion('plan'));

      await service.generateRecommendation(multiGaps);

      const prompt: string = mockCreate.mock.calls[0][0].messages[0].content;
      expect(prompt).toContain('ABAP');
      expect(prompt).toContain('K2');
      expect(prompt).toContain('K4');
      expect(prompt).toContain('BW/4HANA');
      expect(prompt).toContain('K1');
      expect(prompt).toContain('K5');
    });

    it('uses temperature=0.3 for all Groq calls', async () => {
      mockCreate.mockResolvedValueOnce(makeCompletion('plan'));

      await service.generateRecommendation(gaps);

      expect(mockCreate.mock.calls[0][0].temperature).toBe(0.3);
    });

    it('throws ServiceUnavailableException when Groq API rejects', async () => {
      mockCreate.mockRejectedValueOnce(new Error('service down'));

      await expect(service.generateRecommendation(gaps)).rejects.toThrow(
        ServiceUnavailableException,
      );
    });
  });
});
