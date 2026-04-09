import { Injectable, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { LlmService } from '../llm/llm.service';
import { RecommendationStatus } from '../../generated/prisma';

@Injectable()
export class RecommendationsService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly llm: LlmService,
  ) {}

  /** UC-04: персонализированные рекомендации по итогам попытки */
  async generateForAttempt(attemptId: string, employeeId: string) {
    const attempt = await this.prisma.testAttempt.findUnique({
      where: { attemptId },
      include: {
        competencyResults: { include: { competency: true } },
        competencyGaps: { include: { competency: true } },
      },
    });
    if (!attempt) throw new NotFoundException(`Attempt ${attemptId} not found`);

    const gaps = attempt.competencyGaps;
    if (gaps.length === 0) return [];

    // LLM-генерация рекомендаций (PROMPT_RECOMMENDATIONS — см. llm.service.ts)
    const recommendations = await this.llm.generateRecommendations({
      gaps: gaps.map((g) => ({
        competencyName: g.competency.name,
        competencyArea: g.competency.area,
        actualGrade: g.actualGrade,
        targetGrade: g.targetGrade,
      })),
    });

    // Сохраняем рекомендации по каждому гэпу
    const created = await Promise.all(
      recommendations.map((rec) =>
        this.prisma.recommendation.create({
          data: {
            gapId: rec.gapId,
            employeeId,
            courseId: rec.courseId,
            courseTitle: rec.courseTitle,
            priority: rec.priority,
            explanation: rec.explanation,
          },
        }),
      ),
    );
    return created;
  }

  findByEmployee(employeeId: string) {
    return this.prisma.recommendation.findMany({
      where: { employeeId },
      include: { gap: { include: { competency: true } } },
      orderBy: [{ priority: 'asc' }, { createdAt: 'desc' }],
    });
  }

  async updateStatus(recommendationId: string, status: RecommendationStatus) {
    const rec = await this.prisma.recommendation.findUnique({
      where: { recommendationId },
    });
    if (!rec) throw new NotFoundException(`Recommendation ${recommendationId} not found`);
    return this.prisma.recommendation.update({
      where: { recommendationId },
      data: { status },
    });
  }
}
