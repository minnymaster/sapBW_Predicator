import { Test, TestingModule } from '@nestjs/testing';
import { AttemptsService } from './attempts.service';
import { PrismaService } from '../prisma/prisma.service';
import { LlmQueueService } from '../llm/llm-queue.service';

/**
 * Unit tests for AttemptsService.calculateGrade (private method).
 *
 * Thresholds per ВКР гл. 2:
 *   K1: pct ≤ 20%   K2: 20 < pct ≤ 40   K3: 40 < pct ≤ 60
 *   K4: 60 < pct ≤ 80                    K5: pct > 80
 *
 * The method uses strict > comparisons, so the boundary value itself
 * belongs to the LOWER grade (e.g. exactly 80% → K4, not K5).
 */
describe('AttemptsService.calculateGrade (UC-03 grade thresholds)', () => {
  let service: AttemptsService;

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        AttemptsService,
        { provide: PrismaService, useValue: {} },
        { provide: LlmQueueService, useValue: {} },
      ],
    }).compile();

    service = module.get(AttemptsService);
  });

  const grade = (score: number, max: number) =>
    (service as any).calculateGrade(score, max) as string;

  // ---------------------------------------------------------------------------
  // Guard: division by zero
  // ---------------------------------------------------------------------------

  it('returns K1 when max is 0 (division guard)', () => {
    expect(grade(0, 0)).toBe('K1');
  });

  // ---------------------------------------------------------------------------
  // K1 range: pct ≤ 20%
  // ---------------------------------------------------------------------------

  it('returns K1 for 0% (score = 0)', () => {
    expect(grade(0, 100)).toBe('K1');
  });

  it('returns K1 for 10% (midpoint of K1 range)', () => {
    expect(grade(10, 100)).toBe('K1');
  });

  it('returns K1 for exactly 20% (boundary — NOT strictly greater)', () => {
    expect(grade(20, 100)).toBe('K1');
  });

  it('returns K1 for 1/10 (10%)', () => {
    expect(grade(1, 10)).toBe('K1');
  });

  it('returns K1 for 2/10 (20%)', () => {
    expect(grade(2, 10)).toBe('K1');
  });

  // ---------------------------------------------------------------------------
  // K2 range: 20 < pct ≤ 40%
  // ---------------------------------------------------------------------------

  it('returns K2 for 21% (just above K1 threshold)', () => {
    expect(grade(21, 100)).toBe('K2');
  });

  it('returns K2 for 30% (midpoint of K2 range)', () => {
    expect(grade(30, 100)).toBe('K2');
  });

  it('returns K2 for exactly 40% (boundary — NOT strictly greater)', () => {
    expect(grade(40, 100)).toBe('K2');
  });

  it('returns K2 for 3/10 (30%)', () => {
    expect(grade(3, 10)).toBe('K2');
  });

  it('returns K2 for 4/10 (40%)', () => {
    expect(grade(4, 10)).toBe('K2');
  });

  // ---------------------------------------------------------------------------
  // K3 range: 40 < pct ≤ 60%
  // ---------------------------------------------------------------------------

  it('returns K3 for 41% (just above K2 threshold)', () => {
    expect(grade(41, 100)).toBe('K3');
  });

  it('returns K3 for 50% (midpoint of K3 range)', () => {
    expect(grade(50, 100)).toBe('K3');
  });

  it('returns K3 for exactly 60% (boundary — NOT strictly greater)', () => {
    expect(grade(60, 100)).toBe('K3');
  });

  it('returns K3 for 5/10 (50%)', () => {
    expect(grade(5, 10)).toBe('K3');
  });

  it('returns K3 for 6/10 (60%)', () => {
    expect(grade(6, 10)).toBe('K3');
  });

  // ---------------------------------------------------------------------------
  // K4 range: 60 < pct ≤ 80%
  // ---------------------------------------------------------------------------

  it('returns K4 for 61% (just above K3 threshold)', () => {
    expect(grade(61, 100)).toBe('K4');
  });

  it('returns K4 for 70% (midpoint of K4 range)', () => {
    expect(grade(70, 100)).toBe('K4');
  });

  it('returns K4 for exactly 80% (boundary — NOT strictly greater)', () => {
    expect(grade(80, 100)).toBe('K4');
  });

  it('returns K4 for 7/10 (70%)', () => {
    expect(grade(7, 10)).toBe('K4');
  });

  it('returns K4 for 8/10 (80%)', () => {
    expect(grade(8, 10)).toBe('K4');
  });

  // ---------------------------------------------------------------------------
  // K5 range: pct > 80%
  // ---------------------------------------------------------------------------

  it('returns K5 for 81% (just above K4 threshold)', () => {
    expect(grade(81, 100)).toBe('K5');
  });

  it('returns K5 for 90% (midpoint of K5 range)', () => {
    expect(grade(90, 100)).toBe('K5');
  });

  it('returns K5 for 100%', () => {
    expect(grade(100, 100)).toBe('K5');
  });

  it('returns K5 for 9/10 (90%)', () => {
    expect(grade(9, 10)).toBe('K5');
  });

  it('returns K5 for 10/10 (100%)', () => {
    expect(grade(10, 10)).toBe('K5');
  });

  // ---------------------------------------------------------------------------
  // Non-integer max scores (Decimal fields come in as numbers after Number())
  // ---------------------------------------------------------------------------

  it('returns K4 for 0.75/1.0 (75%)', () => {
    expect(grade(0.75, 1.0)).toBe('K4');
  });

  it('returns K5 for 0.9/1.0 (90%)', () => {
    expect(grade(0.9, 1.0)).toBe('K5');
  });

  it('returns K1 for 0.0/1.0 (0%)', () => {
    expect(grade(0.0, 1.0)).toBe('K1');
  });
});
