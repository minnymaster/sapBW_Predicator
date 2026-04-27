import { Injectable, Logger } from '@nestjs/common';
import {
  ReportsClientService,
  CompetencyCoverageResponse,
  KpiProgressResponse,
  ReportsQuery,
} from '../http-clients/reports-client.service';
import { RedisService, CACHE_TTL_SECONDS } from '../redis/redis.service';
import { SummaryQueryDto } from './dto/summary-query.dto';
import {
  GradeDistributionDto,
  SummaryResponseDto,
  TopGapDto,
} from './dto/summary.dto';

const TOP_GAPS_LIMIT = 5;

// Грейды K3+ считаются «покрытыми» (adequate, выше baseline Junior K1/K2)
const ADEQUATE_COUNTS = (r: { k3_count: number; k4_count: number; k5_count: number }) =>
  r.k3_count + r.k4_count + r.k5_count;

@Injectable()
export class DashboardService {
  private readonly logger = new Logger(DashboardService.name);

  constructor(
    private readonly reports: ReportsClientService,
    private readonly redis: RedisService,
  ) {}

  // ---------------------------------------------------------------------------
  // GET /v1/dashboard/summary
  // Проверяет кэш Redis → если промах, агрегирует данные через межсервисные
  // HTTP-запросы к reports-api, сохраняет результат с TTL 300 с.
  // ---------------------------------------------------------------------------

  async getSummary(
    query: SummaryQueryDto,
    jwtToken: string,
  ): Promise<SummaryResponseDto> {
    const cacheKey = this.buildCacheKey(query);
    const cached = await this.redis.get<SummaryResponseDto>(cacheKey);
    if (cached) {
      this.logger.debug(`Cache hit: ${cacheKey}`);
      return cached;
    }

    this.logger.debug(`Cache miss: ${cacheKey} — fetching from reports-api`);
    const summary = await this.computeSummary(query, jwtToken);
    await this.redis.set(cacheKey, summary, CACHE_TTL_SECONDS);
    return summary;
  }

  // ---------------------------------------------------------------------------
  // Внутренняя агрегация: два параллельных HTTP-запроса к reports-api,
  // затем локальный расчёт метрик.
  // ---------------------------------------------------------------------------

  async computeSummary(
    query: SummaryQueryDto,
    jwtToken: string,
  ): Promise<SummaryResponseDto> {
    const reportsQuery: ReportsQuery = {
      department_id: query.department_id,
      period_from: query.period_from,
      period_to: query.period_to,
    };

    // Параллельные запросы — coverage и kpi независимы
    const [coverage, kpi] = await Promise.all([
      this.reports.getCompetencyCoverage(reportsQuery, jwtToken),
      this.reports.getKpiProgress(reportsQuery, jwtToken),
    ]);

    const gradeDistribution = this.aggregateGradeDistribution(coverage);
    const coveragePercent = this.computeCoveragePercent(coverage);
    const topGaps = this.extractTopGaps(kpi);
    const kpiSummary = this.computeKpiSummary(kpi);

    const now = new Date().toISOString();
    return {
      department_id: query.department_id ?? null,
      period_from: query.period_from ?? null,
      period_to: query.period_to ?? null,
      coverage_percent: coveragePercent,
      grade_distribution: gradeDistribution,
      top_gaps: topGaps,
      kpi_summary: kpiSummary,
      cached_at: now,
      cache_ttl_seconds: CACHE_TTL_SECONDS,
    };
  }

  // ---------------------------------------------------------------------------
  // Private: агрегация грейдов по всем компетенциям
  // ---------------------------------------------------------------------------

  private aggregateGradeDistribution(
    coverage: CompetencyCoverageResponse,
  ): GradeDistributionDto {
    const dist = { K1: 0, K2: 0, K3: 0, K4: 0, K5: 0 };
    for (const row of coverage.data) {
      dist.K1 += row.k1_count;
      dist.K2 += row.k2_count;
      dist.K3 += row.k3_count;
      dist.K4 += row.k4_count;
      dist.K5 += row.k5_count;
    }
    return dist;
  }

  // coverage_percent = средний % сотрудников с грейдом K3+ по всем компетенциям
  private computeCoveragePercent(coverage: CompetencyCoverageResponse): number {
    if (coverage.data.length === 0) return 0;

    const percents = coverage.data
      .filter((r) => r.total_count > 0)
      .map((r) => (ADEQUATE_COUNTS(r) / r.total_count) * 100);

    if (percents.length === 0) return 0;
    const avg = percents.reduce((s, p) => s + p, 0) / percents.length;
    return Math.round(avg * 100) / 100;
  }

  // top_gaps = KPI ниже цели, отсортированные по разрыву (target − actual), топ-5
  private extractTopGaps(kpi: KpiProgressResponse): TopGapDto[] {
    return kpi.data
      .filter((item) => !item.is_on_track)
      .map((item) => ({
        competency_id: item.competency_id,
        competency_name: item.competency_name,
        target_grade: item.target_grade,
        target_percent: item.target_percent,
        actual_percent: item.actual_percent,
        gap: Math.round((item.target_percent - item.actual_percent) * 100) / 100,
      }))
      .sort((a, b) => b.gap - a.gap)
      .slice(0, TOP_GAPS_LIMIT);
  }

  private computeKpiSummary(kpi: KpiProgressResponse) {
    return {
      on_track: kpi.data.filter((i) => i.is_on_track).length,
      total: kpi.data.length,
    };
  }

  // cache key включает все параметры фильтра, чтобы не возвращать кэш другого dept
  private buildCacheKey(query: SummaryQueryDto): string {
    const dept = query.department_id ?? 'all';
    const from = query.period_from ?? 'open';
    const to = query.period_to ?? 'open';
    return `dashboard:summary:dept=${dept}:from=${from}:to=${to}`;
  }
}
