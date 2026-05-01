import { Injectable } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';

type Grade = 'K1' | 'K2' | 'K3' | 'K4' | 'K5';

@Injectable()
export class DashboardService {
  constructor(private readonly prisma: PrismaService) {}

  /**
   * UC-13 (employee): краткая сводка для главной страницы сотрудника.
   * Данные вычисляются из certification_db (попытки, результаты, грейды).
   * Дедлайны заданий недоступны (они в company_db), поэтому deadline = null.
   */
  async getEmployeeSummary(employeeId: string) {
    // Все завершённые попытки с результатами по компетенциям
    const completedAttempts = await this.prisma.testAttempt.findMany({
      where: { employeeId, status: 'completed' },
      include: {
        competencyResults: {
          include: { competency: { select: { name: true, area: true } } },
        },
      },
      orderBy: { finishedAt: 'desc' },
    });

    // Берём последний результат по каждой компетенции (попытки отсортированы desc)
    const latestByComp = new Map<
      string,
      { competencyId: string; name: string; area: string; score: number; grade: Grade }
    >();

    for (const attempt of completedAttempts) {
      for (const cr of attempt.competencyResults) {
        if (latestByComp.has(cr.competencyId)) continue;
        const scorePct =
          Number(cr.maxScore) > 0
            ? Math.round((Number(cr.score) / Number(cr.maxScore)) * 100)
            : 0;
        latestByComp.set(cr.competencyId, {
          competencyId: cr.competencyId,
          name: cr.competency.name,
          area: cr.competency.area as string,
          score: scorePct,
          grade: cr.gradeAchieved as Grade,
        });
      }
    }

    const competencies = [...latestByComp.values()];

    // Общий грейд — среднее score по всем компетенциям
    const avgScore =
      competencies.length > 0
        ? competencies.reduce((s, c) => s + c.score, 0) / competencies.length
        : 0;
    const overallGrade = this.scoreToGrade(avgScore);

    // Покрытие: доля компетенций с грейдом K3+
    const k3plus = competencies.filter((c) =>
      ['K3', 'K4', 'K5'].includes(c.grade),
    ).length;
    const coveragePercent =
      competencies.length > 0
        ? Math.round((k3plus / competencies.length) * 100)
        : 0;

    // Ближайшие тесты: активные, без завершённой попытки у этого сотрудника
    const completedTestIds = new Set(completedAttempts.map((a) => a.testId));
    const activeTests = await this.prisma.test.findMany({
      where: { isActive: true },
      include: { _count: { select: { testQuestions: true } } },
      orderBy: { createdAt: 'desc' },
    });

    const upcomingTests = activeTests
      .filter((t) => !completedTestIds.has(t.testId))
      .slice(0, 3)
      .map((t) => ({
        testId: t.testId,
        title: t.title,
        deadline: null,
        passingScore: Number(t.passingScore),
        questionCount: t._count.testQuestions,
      }));

    return {
      overall_grade: overallGrade,
      coverage_percent: coveragePercent,
      competencies: competencies.map((c) => ({
        competencyId: c.competencyId,
        name: c.name,
        area: c.area,
        grade: c.grade,
        score: c.score,
      })),
      upcoming_tests: upcomingTests,
    };
  }

  private scoreToGrade(pct: number): Grade {
    if (pct > 80) return 'K5';
    if (pct > 60) return 'K4';
    if (pct > 40) return 'K3';
    if (pct > 20) return 'K2';
    return 'K1';
  }
}
