import { Test, TestingModule } from '@nestjs/testing';
import {
  BadRequestException,
  ConflictException,
  NotFoundException,
} from '@nestjs/common';
import { QuestionsService } from './questions.service';
import { CertificationPrismaService } from '../prisma/certification-prisma.service';

// ---------------------------------------------------------------------------
// Mock Prisma transaction client (used inside $transaction callback)
// ---------------------------------------------------------------------------
const mockTx = {
  question: {
    update: jest.fn(),
    create: jest.fn(),
  },
};

// ---------------------------------------------------------------------------
// Mock CertificationPrismaService
// ---------------------------------------------------------------------------
const mockPrisma = {
  question: {
    findFirst: jest.fn(),
    create: jest.fn(),
    update: jest.fn(),
    findMany: jest.fn(),
    count: jest.fn(),
  },
  testQuestion: {
    findFirst: jest.fn(),
  },
  $transaction: jest.fn(),
};

// ---------------------------------------------------------------------------
// Fixture factory
// ---------------------------------------------------------------------------
const makeQuestion = (overrides: Record<string, unknown> = {}) => ({
  questionId: 'q-uuid-v1',
  rootId: 'root-uuid-1',
  versionNumber: 1,
  competencyId: 'comp-uuid-1',
  type: 'single_choice',
  difficulty: 'medium',
  text: 'Что такое InfoCube в SAP BW?',
  explanation: 'InfoCube — многомерная структура данных.',
  maxScore: 1.0,
  isCurrent: true,
  isLlmGenerated: false,
  createdBy: 'user-uuid-1',
  createdAt: new Date('2025-01-01'),
  answerOptions: [],
  ...overrides,
});

// ---------------------------------------------------------------------------
// Suite
// ---------------------------------------------------------------------------

describe('QuestionsService – question versioning (NFR-18)', () => {
  let service: QuestionsService;

  beforeEach(async () => {
    jest.clearAllMocks();

    // Default $transaction: call the callback with mockTx
    mockPrisma.$transaction.mockImplementation((fn: (tx: typeof mockTx) => unknown) =>
      Promise.resolve(fn(mockTx)),
    );

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        QuestionsService,
        { provide: CertificationPrismaService, useValue: mockPrisma },
      ],
    }).compile();

    service = module.get(QuestionsService);
  });

  // =========================================================================
  // update() — creates new version (PUT /v1/questions/:id)
  // =========================================================================

  describe('update()', () => {
    it('deactivates the current version and creates a new one in a transaction', async () => {
      const existing = makeQuestion({ versionNumber: 2 });
      const created = makeQuestion({ questionId: 'q-uuid-v3', versionNumber: 3, isCurrent: true });

      mockPrisma.question.findFirst.mockResolvedValue(existing);
      mockTx.question.update.mockResolvedValue({ ...existing, isCurrent: false });
      mockTx.question.create.mockResolvedValue({ ...created, answerOptions: [] });

      const result = await service.update('q-uuid-v2', { text: 'Новый текст' } as any, 'user-uuid-1');

      // Old version deactivated
      expect(mockTx.question.update).toHaveBeenCalledWith({
        where: { questionId: 'q-uuid-v2' },
        data: { isCurrent: false },
      });

      // New version created with incremented versionNumber and same rootId
      expect(mockTx.question.create).toHaveBeenCalledWith(
        expect.objectContaining({
          data: expect.objectContaining({
            rootId: existing.rootId,
            versionNumber: existing.versionNumber + 1,
            isCurrent: true,
          }),
        }),
      );

      expect(result.versionNumber).toBe(3);
      expect(result.isCurrent).toBe(true);
    });

    it('preserves rootId so the logical question identity is stable', async () => {
      const existing = makeQuestion({ rootId: 'stable-root-uuid' });
      mockPrisma.question.findFirst.mockResolvedValue(existing);
      mockTx.question.update.mockResolvedValue({});
      mockTx.question.create.mockResolvedValue({
        ...makeQuestion({ rootId: 'stable-root-uuid', versionNumber: 2 }),
        answerOptions: [],
      });

      await service.update('q-uuid-v1', {} as any, 'user-uuid-1');

      const createCall = mockTx.question.create.mock.calls[0][0];
      expect(createCall.data.rootId).toBe('stable-root-uuid');
    });

    it('applies DTO field over-rides and falls back to existing values for undefined fields', async () => {
      const existing = makeQuestion({
        difficulty: 'hard',
        explanation: 'Оригинальное объяснение',
        competencyId: 'comp-uuid-original',
        versionNumber: 1,
      });
      mockPrisma.question.findFirst.mockResolvedValue(existing);
      mockTx.question.update.mockResolvedValue({});
      mockTx.question.create.mockResolvedValue({
        ...makeQuestion({ versionNumber: 2 }),
        answerOptions: [],
      });

      // Only text is changed; difficulty, explanation, competencyId must be inherited
      await service.update('q-uuid-v1', { text: 'Обновлённый вопрос' } as any, 'user-uuid-1');

      const createCall = mockTx.question.create.mock.calls[0][0];
      expect(createCall.data.text).toBe('Обновлённый вопрос');
      expect(createCall.data.difficulty).toBe(existing.difficulty);
      expect(createCall.data.explanation).toBe(existing.explanation);
      expect(createCall.data.competencyId).toBe(existing.competencyId);
    });

    it('copies existing answerOptions when DTO.answerOptions is undefined', async () => {
      const existingOptions = [
        { text: 'Вариант A', isCorrect: true, orderNumber: 0 },
        { text: 'Вариант B', isCorrect: false, orderNumber: 1 },
      ];
      const existing = makeQuestion({ answerOptions: existingOptions });

      mockPrisma.question.findFirst.mockResolvedValue(existing);
      mockTx.question.update.mockResolvedValue({});
      mockTx.question.create.mockResolvedValue({
        ...makeQuestion({ versionNumber: 2 }),
        answerOptions: existingOptions,
      });

      // No answerOptions in DTO → must copy from existing
      await service.update('q-uuid-v1', {} as any, 'user-uuid-1');

      const createCall = mockTx.question.create.mock.calls[0][0];
      expect(createCall.data.answerOptions.create).toHaveLength(2);
      expect(createCall.data.answerOptions.create[0].text).toBe('Вариант A');
      expect(createCall.data.answerOptions.create[0].isCorrect).toBe(true);
    });

    it('uses DTO answerOptions instead of existing ones when provided', async () => {
      const existing = makeQuestion({
        answerOptions: [{ text: 'Старый вариант', isCorrect: true, orderNumber: 0 }],
      });

      mockPrisma.question.findFirst.mockResolvedValue(existing);
      mockTx.question.update.mockResolvedValue({});
      mockTx.question.create.mockResolvedValue({
        ...makeQuestion({ versionNumber: 2 }),
        answerOptions: [],
      });

      const dto = {
        answerOptions: [
          { text: 'Новый вариант 1', isCorrect: true, orderNumber: 0 },
          { text: 'Новый вариант 2', isCorrect: false, orderNumber: 1 },
        ],
      };

      await service.update('q-uuid-v1', dto as any, 'user-uuid-1');

      const createCall = mockTx.question.create.mock.calls[0][0];
      expect(createCall.data.answerOptions.create).toHaveLength(2);
      expect(createCall.data.answerOptions.create[0].text).toBe('Новый вариант 1');
      expect(createCall.data.answerOptions.create[1].text).toBe('Новый вариант 2');
    });

    it('sets createdBy to the user performing the update', async () => {
      const existing = makeQuestion({ createdBy: 'original-creator' });
      mockPrisma.question.findFirst.mockResolvedValue(existing);
      mockTx.question.update.mockResolvedValue({});
      mockTx.question.create.mockResolvedValue({
        ...makeQuestion({ versionNumber: 2, createdBy: 'new-editor' }),
        answerOptions: [],
      });

      await service.update('q-uuid-v1', {} as any, 'new-editor');

      const createCall = mockTx.question.create.mock.calls[0][0];
      expect(createCall.data.createdBy).toBe('new-editor');
    });

    it('throws NotFoundException when question is not found', async () => {
      mockPrisma.question.findFirst.mockResolvedValue(null);

      await expect(
        service.update('nonexistent-id', {}, 'user-uuid-1'),
      ).rejects.toThrow(NotFoundException);
    });

    it('throws NotFoundException when question exists but isCurrent=false', async () => {
      // findFirst with { isCurrent: true } returns null for an archived version
      mockPrisma.question.findFirst.mockResolvedValue(null);

      await expect(
        service.update('archived-question-id', {}, 'user-uuid-1'),
      ).rejects.toThrow(NotFoundException);
    });

    it('executes deactivation and creation inside a single $transaction', async () => {
      const existing = makeQuestion();
      mockPrisma.question.findFirst.mockResolvedValue(existing);
      mockTx.question.update.mockResolvedValue({});
      mockTx.question.create.mockResolvedValue({ ...makeQuestion({ versionNumber: 2 }), answerOptions: [] });

      await service.update('q-uuid-v1', {} as any, 'user-uuid-1');

      expect(mockPrisma.$transaction).toHaveBeenCalledTimes(1);
      // Both operations happen via mockTx (the transaction client)
      expect(mockTx.question.update).toHaveBeenCalledTimes(1);
      expect(mockTx.question.create).toHaveBeenCalledTimes(1);
    });
  });

  // =========================================================================
  // create() — creates first version
  // =========================================================================

  describe('create()', () => {
    it('creates a question with versionNumber=1 and isCurrent=true', async () => {
      const created = makeQuestion();
      mockPrisma.question.create.mockResolvedValue({ ...created, answerOptions: [] });

      const dto = {
        competencyId: 'comp-uuid-1',
        type: 'single_choice',
        difficulty: 'medium',
        text: 'Что такое InfoCube?',
      };

      const result = await service.create(dto as any, 'user-uuid-1');

      expect(mockPrisma.question.create).toHaveBeenCalledWith(
        expect.objectContaining({
          data: expect.objectContaining({
            versionNumber: 1,
            isCurrent: true,
            isLlmGenerated: false,
          }),
        }),
      );
      expect(result.versionNumber).toBe(1);
      expect(result.isCurrent).toBe(true);
    });

    it('generates a new rootId (UUID) for each question', async () => {
      mockPrisma.question.create.mockImplementation((args: { data: { rootId: string } }) =>
        Promise.resolve({ ...makeQuestion({ rootId: args.data.rootId }), answerOptions: [] }),
      );

      const dto = { competencyId: 'c', type: 'short_answer', difficulty: 'easy', text: 'Q?' };
      const r1 = await service.create(dto as any, 'u1');
      const r2 = await service.create(dto as any, 'u1');

      expect(r1.rootId).not.toBe(r2.rootId);
    });

    it('throws BadRequestException when competencyId does not exist (P2003)', async () => {
      const { PrismaClientKnownRequestError } =
        // eslint-disable-next-line @typescript-eslint/no-var-requires
        require('../../generated/certification-prisma').Prisma;

      const err = new PrismaClientKnownRequestError('FK violation', {
        code: 'P2003',
        clientVersion: '5.x',
      });
      mockPrisma.question.create.mockRejectedValue(err);

      const dto = { competencyId: 'bad-comp', type: 'short_answer', difficulty: 'easy', text: 'Q?' };
      await expect(service.create(dto as any, 'u1')).rejects.toThrow(BadRequestException);
    });
  });

  // =========================================================================
  // delete() — soft delete (DELETE /v1/questions/:id)
  // =========================================================================

  describe('delete()', () => {
    it('soft-deletes by setting isCurrent=false', async () => {
      const existing = makeQuestion();
      mockPrisma.question.findFirst.mockResolvedValue(existing);
      mockPrisma.testQuestion.findFirst.mockResolvedValue(null);
      mockPrisma.question.update.mockResolvedValue({ ...existing, isCurrent: false });

      await service.delete('q-uuid-v1');

      expect(mockPrisma.question.update).toHaveBeenCalledWith({
        where: { questionId: 'q-uuid-v1' },
        data: { isCurrent: false },
      });
    });

    it('does not hard-delete — the record is preserved for audit', async () => {
      const existing = makeQuestion();
      mockPrisma.question.findFirst.mockResolvedValue(existing);
      mockPrisma.testQuestion.findFirst.mockResolvedValue(null);
      mockPrisma.question.update.mockResolvedValue({});

      await service.delete('q-uuid-v1');

      // delete() is never called on the prisma mock — only update() is
      expect(mockPrisma.question).not.toHaveProperty('delete');
    });

    it('checks all versions with the same rootId for active test usage', async () => {
      const existing = makeQuestion({ rootId: 'shared-root' });
      mockPrisma.question.findFirst.mockResolvedValue(existing);
      mockPrisma.testQuestion.findFirst.mockResolvedValue(null);
      mockPrisma.question.update.mockResolvedValue({});

      await service.delete('q-uuid-v1');

      expect(mockPrisma.testQuestion.findFirst).toHaveBeenCalledWith(
        expect.objectContaining({
          where: expect.objectContaining({
            question: { rootId: 'shared-root' },
          }),
        }),
      );
    });

    it('throws ConflictException when question is referenced by an active test', async () => {
      const existing = makeQuestion();
      mockPrisma.question.findFirst.mockResolvedValue(existing);
      mockPrisma.testQuestion.findFirst.mockResolvedValue({ testId: 'active-test-id' });

      await expect(service.delete('q-uuid-v1')).rejects.toThrow(ConflictException);
      expect(mockPrisma.question.update).not.toHaveBeenCalled();
    });

    it('throws NotFoundException when question is not found or is not current', async () => {
      mockPrisma.question.findFirst.mockResolvedValue(null);

      await expect(service.delete('nonexistent-id')).rejects.toThrow(NotFoundException);
      expect(mockPrisma.question.update).not.toHaveBeenCalled();
    });
  });
});
