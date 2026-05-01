/**
 * Integration test: POST /v1/attempts/:id/finish (UC-03)
 *
 * Prerequisites:
 *   CERTIFICATION_DATABASE_URL must point to a running PostgreSQL instance
 *   with the certification_db schema applied (prisma migrate deploy).
 *   Redis is NOT required — LlmQueueService is mocked.
 *
 * Run: npm run test:e2e
 */

import { Test, TestingModule } from '@nestjs/testing';
import { ConfigModule } from '@nestjs/config';
import { BadRequestException, ForbiddenException, NotFoundException } from '@nestjs/common';
import { AttemptsService } from '../src/attempts/attempts.service';
import { PrismaService } from '../src/prisma/prisma.service';
import { LlmQueueService } from '../src/llm/llm-queue.service';

// Ensure the URL is set before the Prisma client is constructed
if (!process.env.CERTIFICATION_DATABASE_URL) {
  process.env.CERTIFICATION_DATABASE_URL =
    'postgresql://postgres:postgres@localhost:5432/certification_db_test';
}

// ---------------------------------------------------------------------------
// Fixed UUIDs — used across seed / cleanup helpers
// ---------------------------------------------------------------------------
const EMPLOYEE_ID = 'eeeeeeee-eeee-eeee-eeee-000000000001';
const OTHER_EMPLOYEE_ID = 'eeeeeeee-eeee-eeee-eeee-000000000002';

// ---------------------------------------------------------------------------
// Seed helpers
// ---------------------------------------------------------------------------

interface SeedResult {
  competencyId: string;
  testId: string;
  questionId: string;
  attemptId: string;
}

async function seedScenario(
  prisma: PrismaService,
  opts: {
    minGrade: string;
    answerScore: number;   // score recorded in AnswerLog
    maxScore?: number;     // question maxScore (default 1.0)
  },
): Promise<SeedResult> {
  const { minGrade, answerScore, maxScore = 1.0 } = opts;

  const competency = await prisma.competency.create({
    data: {
      name: `Test Competency ${Date.now()} ${Math.random()}`,
      area: 'data_modeling',
      minGrade: minGrade as any,
      isActive: true,
    },
  });

  const question = await prisma.question.create({
    data: {
      rootId: require('crypto').randomUUID(),
      versionNumber: 1,
      competencyId: competency.competencyId,
      type: 'single_choice',
      difficulty: 'medium',
      text: 'Что такое InfoCube?',
      maxScore,
      isCurrent: true,
    },
  });

  const test = await prisma.test.create({
    data: {
      title: `Test ${Date.now()}`,
      isActive: true,
      maxAttempts: 3,
    },
  });

  const attempt = await prisma.testAttempt.create({
    data: {
      testId: test.testId,
      employeeId: EMPLOYEE_ID,
      status: 'in_progress',
    },
  });

  await prisma.answerLog.create({
    data: {
      attemptId: attempt.attemptId,
      questionId: question.questionId,
      selectedOptionIds: [],
      isCorrect: answerScore > 0,
      score: answerScore,
      needsHrReview: false,
    },
  });

  return {
    competencyId: competency.competencyId,
    testId: test.testId,
    questionId: question.questionId,
    attemptId: attempt.attemptId,
  };
}

async function cleanup(prisma: PrismaService, seed: SeedResult): Promise<void> {
  // Delete in dependency order (FK constraints).
  // TestAttempt cascade-deletes: AnswerLog, CompetencyResult, CompetencyGap, Recommendation.
  await prisma.testAttempt.deleteMany({ where: { attemptId: seed.attemptId } });
  // AnswerLog for this question is now gone — safe to delete Question.
  await prisma.question.deleteMany({ where: { questionId: seed.questionId } });
  // TestQuestion cascade-deleted with Test.
  await prisma.test.deleteMany({ where: { testId: seed.testId } });
  await prisma.competency.deleteMany({ where: { competencyId: seed.competencyId } });
}

// ---------------------------------------------------------------------------
// Module setup
// ---------------------------------------------------------------------------

describe('AttemptsService.finish (integration — real DB)', () => {
  let module: TestingModule;
  let svc: AttemptsService;
  let prisma: PrismaService;

  beforeAll(async () => {
    module = await Test.createTestingModule({
      imports: [ConfigModule.forRoot({ isGlobal: true })],
      providers: [
        AttemptsService,
        PrismaService,
        {
          provide: LlmQueueService,
          useValue: { evaluateOpenAnswer: jest.fn().mockResolvedValue(undefined) },
        },
      ],
    }).compile();

    await module.init();

    svc = module.get(AttemptsService);
    prisma = module.get(PrismaService);
  });

  afterAll(async () => {
    await module.close();
  });

  // -------------------------------------------------------------------------
  // Scenario 1: wrong answer → K1 grade, gap created
  // -------------------------------------------------------------------------

  describe('wrong answer → K1 grade, competency gap created', () => {
    let seed: SeedResult;

    beforeAll(async () => {
      // Competency requires K3; employee scores 0/1 → 0% → K1 → gap K1 < K3
      seed = await seedScenario(prisma, { minGrade: 'K3', answerScore: 0, maxScore: 1.0 });
    });

    afterAll(async () => {
      await cleanup(prisma, seed);
    });

    it('returns status=completed', async () => {
      const result = await svc.finish(seed.attemptId, EMPLOYEE_ID);
      expect(result.status).toBe('completed');
    });

    it('returns gradeAchieved=K1 for 0% score', async () => {
      const attempt = await prisma.testAttempt.findUnique({
        where: { attemptId: seed.attemptId },
      });
      expect(attempt!.gradeAchieved).toBe('K1');
    });

    it('sets totalScore=0 and maxScore=1 on the attempt', async () => {
      const attempt = await prisma.testAttempt.findUnique({
        where: { attemptId: seed.attemptId },
      });
      expect(Number(attempt!.totalScore)).toBe(0);
      expect(Number(attempt!.maxScore)).toBe(1);
    });

    it('creates exactly 1 CompetencyResult', async () => {
      const results = await prisma.competencyResult.findMany({
        where: { attemptId: seed.attemptId },
      });
      expect(results).toHaveLength(1);
      expect(results[0].gradeAchieved).toBe('K1');
    });

    it('creates exactly 1 CompetencyGap (actualGrade K1 < minGrade K3)', async () => {
      const gaps = await prisma.competencyGap.findMany({
        where: { attemptId: seed.attemptId },
      });
      expect(gaps).toHaveLength(1);
      expect(gaps[0].actualGrade).toBe('K1');
      expect(gaps[0].targetGrade).toBe('K3');
    });

    it('sets finishedAt timestamp on the attempt', async () => {
      const attempt = await prisma.testAttempt.findUnique({
        where: { attemptId: seed.attemptId },
      });
      expect(attempt!.finishedAt).toBeInstanceOf(Date);
    });

    it('returns competencyResultsCount=1 and competencyGapsCount=1', async () => {
      // Re-finish would fail (status=completed) — verify via DB instead.
      const results = await prisma.competencyResult.count({ where: { attemptId: seed.attemptId } });
      const gaps = await prisma.competencyGap.count({ where: { attemptId: seed.attemptId } });
      expect(results).toBe(1);
      expect(gaps).toBe(1);
    });
  });

  // -------------------------------------------------------------------------
  // Scenario 2: correct answer → K5 grade, no gap
  // -------------------------------------------------------------------------

  describe('correct answer → K5 grade, no competency gap', () => {
    let seed: SeedResult;

    beforeAll(async () => {
      // Competency requires K3; employee scores 1/1 → 100% → K5 → no gap
      seed = await seedScenario(prisma, { minGrade: 'K3', answerScore: 1.0, maxScore: 1.0 });
    });

    afterAll(async () => {
      await cleanup(prisma, seed);
    });

    it('returns gradeAchieved=K5 for 100% score', async () => {
      const result = await svc.finish(seed.attemptId, EMPLOYEE_ID);
      expect(result.gradeAchieved).toBe('K5');
    });

    it('creates 1 CompetencyResult with grade K5', async () => {
      const results = await prisma.competencyResult.findMany({
        where: { attemptId: seed.attemptId },
      });
      expect(results).toHaveLength(1);
      expect(results[0].gradeAchieved).toBe('K5');
    });

    it('creates no CompetencyGap (K5 meets minGrade K3)', async () => {
      const gaps = await prisma.competencyGap.findMany({
        where: { attemptId: seed.attemptId },
      });
      expect(gaps).toHaveLength(0);
    });
  });

  // -------------------------------------------------------------------------
  // Scenario 3: K4 boundary — score exactly 80% → K4 grade, gap vs K5 minGrade
  // -------------------------------------------------------------------------

  describe('80% score → K4 grade, gap when minGrade is K5', () => {
    let seed: SeedResult;

    beforeAll(async () => {
      seed = await seedScenario(prisma, { minGrade: 'K5', answerScore: 0.8, maxScore: 1.0 });
    });

    afterAll(async () => {
      await cleanup(prisma, seed);
    });

    it('returns gradeAchieved=K4 for exactly 80%', async () => {
      const result = await svc.finish(seed.attemptId, EMPLOYEE_ID);
      expect(result.gradeAchieved).toBe('K4');
    });

    it('creates a gap with targetGrade K5', async () => {
      const gaps = await prisma.competencyGap.findMany({
        where: { attemptId: seed.attemptId },
      });
      expect(gaps).toHaveLength(1);
      expect(gaps[0].actualGrade).toBe('K4');
      expect(gaps[0].targetGrade).toBe('K5');
    });
  });

  // -------------------------------------------------------------------------
  // Error cases
  // -------------------------------------------------------------------------

  describe('error handling', () => {
    let seed: SeedResult;

    beforeAll(async () => {
      seed = await seedScenario(prisma, { minGrade: 'K1', answerScore: 0 });
    });

    afterAll(async () => {
      await cleanup(prisma, seed);
    });

    it('throws NotFoundException for unknown attemptId', async () => {
      await expect(
        svc.finish('00000000-0000-0000-0000-000000000000', EMPLOYEE_ID),
      ).rejects.toThrow(NotFoundException);
    });

    it('throws ForbiddenException when employeeId does not match', async () => {
      await expect(
        svc.finish(seed.attemptId, OTHER_EMPLOYEE_ID),
      ).rejects.toThrow(ForbiddenException);
    });

    it('throws BadRequestException when attempt is already completed', async () => {
      // First finish succeeds
      await svc.finish(seed.attemptId, EMPLOYEE_ID);

      // Second finish on same attempt must fail
      await expect(
        svc.finish(seed.attemptId, EMPLOYEE_ID),
      ).rejects.toThrow(BadRequestException);
    });
  });
});
