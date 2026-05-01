import { Injectable, Logger } from '@nestjs/common';
import { Prisma } from '../../generated/prisma';
import { Prisma as CertPrisma } from '../../generated/certification-prisma';
import * as ExcelJS from 'exceljs';
import { PrismaService } from '../prisma/prisma.service';
import { CertificationPrismaService } from '../prisma/certification-prisma.service';
import { CompetencyCoverageQueryDto } from './dto/competency-coverage-query.dto';
import {
  CompetencyCoverageResponseDto,
  GradeDistributionDto,
} from './dto/competency-coverage.dto';
import { KpiProgressQueryDto } from './dto/kpi-progress-query.dto';
import { KpiProgressItemDto, KpiProgressResponseDto } from './dto/kpi-progress.dto';
import { ExportQueryDto, ReportType } from './dto/export-query.dto';
import { AssignmentStatsDto } from './dto/assignment-stats.dto';

// ---------------------------------------------------------------------------
// Raw row types returned by $queryRaw
// ---------------------------------------------------------------------------

interface CompetencyCoverageRow {
  competency_id: string;
  competency_name: string;
  k1_count: bigint;
  k2_count: bigint;
  k3_count: bigint;
  k4_count: bigint;
  k5_count: bigint;
  total_count: bigint;
}

interface KpiProgressRow {
  kpi_id: string;
  competency_id: string;
  competency_name: string;
  target_grade: string;
  target_percent: number;
  period_start: Date;
  period_end: Date | null;
  total_employees: bigint;
  met_count: bigint;
  actual_percent: number | null;
}

interface AttemptSummaryRow {
  employee_id: string;
  total_attempts: bigint;
  completed_attempts: bigint;
  avg_score: number | null;
  last_attempt_at: Date | null;
}

@Injectable()
export class ReportsService {
  private readonly logger = new Logger(ReportsService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly certPrisma: CertificationPrismaService,
  ) {}

  // ---------------------------------------------------------------------------
  // GET /v1/reports/competency-coverage
  // Распределение грейдов по компетенциям с фильтрами department_id + period.
  // $queryRaw — FILTER (WHERE ...) агрегат не выражается через Prisma ORM.
  // ---------------------------------------------------------------------------

  async getCompetencyCoverage(
    dto: CompetencyCoverageQueryDto,
  ): Promise<CompetencyCoverageResponseDto> {
    const { department_id, period_from, period_to } = dto;

    const deptFilter = department_id
      ? Prisma.sql`AND e.department_id = ${department_id}::uuid`
      : Prisma.empty;

    const periodFromFilter = period_from
      ? Prisma.sql`AND cp.assessed_at >= ${new Date(period_from)}`
      : Prisma.empty;

    const periodToFilter = period_to
      ? Prisma.sql`AND cp.assessed_at < ${new Date(period_to)}::date + INTERVAL '1 day'`
      : Prisma.empty;

    // Агрегация COUNT с FILTER per grade — PostgreSQL-specific, нет аналога в ORM.
    const rows = await this.prisma.$queryRaw<CompetencyCoverageRow[]>(Prisma.sql`
      SELECT
        cp.competency_id::text                     AS competency_id,
        cp.competency_name                         AS competency_name,
        COUNT(*) FILTER (WHERE cp.grade = 'K1')    AS k1_count,
        COUNT(*) FILTER (WHERE cp.grade = 'K2')    AS k2_count,
        COUNT(*) FILTER (WHERE cp.grade = 'K3')    AS k3_count,
        COUNT(*) FILTER (WHERE cp.grade = 'K4')    AS k4_count,
        COUNT(*) FILTER (WHERE cp.grade = 'K5')    AS k5_count,
        COUNT(*)                                   AS total_count
      FROM competency_profile cp
      JOIN employee e ON cp.employee_id = e.employee_id
      WHERE cp.valid_to IS NULL
        AND e.is_active = true
        ${deptFilter}
        ${periodFromFilter}
        ${periodToFilter}
      GROUP BY cp.competency_id, cp.competency_name
      ORDER BY cp.competency_name
    `);

    const data: GradeDistributionDto[] = rows.map((r) => ({
      competency_id: r.competency_id,
      competency_name: r.competency_name,
      k1_count: Number(r.k1_count),
      k2_count: Number(r.k2_count),
      k3_count: Number(r.k3_count),
      k4_count: Number(r.k4_count),
      k5_count: Number(r.k5_count),
      total_count: Number(r.total_count),
    }));

    return {
      data,
      total: data.length,
      period_from: period_from ?? null,
      period_to: period_to ?? null,
      department_id: department_id ?? null,
    };
  }

  // ---------------------------------------------------------------------------
  // GET /v1/reports/kpi-progress
  // Прогресс KPI подразделения: для каждого целевого KPI считаем долю
  // сотрудников, достигших target_grade или выше.
  // CTE + CROSS JOIN + условная агрегация — не поддерживается Prisma ORM.
  // ---------------------------------------------------------------------------

  async getKpiProgress(dto: KpiProgressQueryDto): Promise<KpiProgressResponseDto> {
    const { department_id, period_from, period_to } = dto;

    const deptFilterEmp = department_id
      ? Prisma.sql`AND e.department_id = ${department_id}::uuid`
      : Prisma.empty;

    const deptFilterKpi = department_id
      ? Prisma.sql`AND (k.department_id IS NULL OR k.department_id = ${department_id}::uuid)`
      : Prisma.empty;

    // Пересечение периода KPI с запрошенным диапазоном
    const periodFromFilter = period_from
      ? Prisma.sql`AND (k.period_end IS NULL OR k.period_end >= ${new Date(period_from)}::date)`
      : Prisma.empty;

    const periodToFilter = period_to
      ? Prisma.sql`AND k.period_start <= ${new Date(period_to)}::date`
      : Prisma.empty;

    // grade_ranks CTE: числовой ранг K1=1…K5=5 для сравнения >=
    const rows = await this.prisma.$queryRaw<KpiProgressRow[]>(Prisma.sql`
      WITH grade_ranks AS (
        SELECT 'K1'::text AS grade, 1 AS rank UNION ALL
        SELECT 'K2',               2          UNION ALL
        SELECT 'K3',               3          UNION ALL
        SELECT 'K4',               4          UNION ALL
        SELECT 'K5',               5
      ),
      dept_employees AS (
        SELECT e.employee_id
        FROM employee e
        WHERE e.is_active = true
          ${deptFilterEmp}
      ),
      dept_employee_count AS (
        SELECT COUNT(*)::bigint AS total FROM dept_employees
      ),
      current_profiles AS (
        SELECT
          cp.employee_id,
          cp.competency_id,
          gr.rank AS grade_rank
        FROM competency_profile cp
        JOIN dept_employees de ON cp.employee_id = de.employee_id
        JOIN grade_ranks gr ON cp.grade::text = gr.grade
        WHERE cp.valid_to IS NULL
      ),
      kpi_targets AS (
        SELECT
          k.kpi_id,
          k.competency_id,
          k.competency_name,
          k.target_grade,
          k.target_percent,
          k.period_start,
          k.period_end,
          gr.rank AS target_rank
        FROM target_kpi k
        JOIN grade_ranks gr ON k.target_grade::text = gr.grade
        WHERE 1 = 1
          ${deptFilterKpi}
          ${periodFromFilter}
          ${periodToFilter}
      )
      SELECT
        kt.kpi_id::text                                      AS kpi_id,
        kt.competency_id::text                               AS competency_id,
        kt.competency_name                                   AS competency_name,
        kt.target_grade::text                                AS target_grade,
        kt.target_percent::float                             AS target_percent,
        kt.period_start                                      AS period_start,
        kt.period_end                                        AS period_end,
        dec.total                                            AS total_employees,
        COUNT(cp.employee_id) FILTER (
          WHERE cp.grade_rank >= kt.target_rank
        )                                                    AS met_count,
        ROUND(
          COUNT(cp.employee_id) FILTER (
            WHERE cp.grade_rank >= kt.target_rank
          )::numeric / NULLIF(dec.total, 0) * 100,
          2
        )::float                                             AS actual_percent
      FROM kpi_targets kt
      CROSS JOIN dept_employee_count dec
      LEFT JOIN current_profiles cp ON cp.competency_id = kt.competency_id
      GROUP BY
        kt.kpi_id, kt.competency_id, kt.competency_name,
        kt.target_grade, kt.target_percent,
        kt.period_start, kt.period_end,
        dec.total, kt.target_rank
      ORDER BY kt.competency_name
    `);

    const data: KpiProgressItemDto[] = rows.map((r) => {
      const actualPercent = Number(r.actual_percent ?? 0);
      const targetPercent = Number(r.target_percent);
      return {
        kpi_id: r.kpi_id,
        competency_id: r.competency_id,
        competency_name: r.competency_name,
        target_grade: r.target_grade,
        target_percent: targetPercent,
        period_start: r.period_start.toISOString().split('T')[0],
        period_end: r.period_end ? r.period_end.toISOString().split('T')[0] : null,
        total_employees: Number(r.total_employees),
        met_count: Number(r.met_count),
        actual_percent: actualPercent,
        is_on_track: actualPercent >= targetPercent,
      };
    });

    return {
      data,
      total: data.length,
      department_id: department_id ?? null,
    };
  }

  // ---------------------------------------------------------------------------
  // GET /v1/reports/assignment-stats
  // Сводка статусов назначений тестов: просроченные, в процессе, завершённые.
  // $queryRaw — GROUP BY на enum с CAST, ORM не генерирует компактный запрос.
  // ---------------------------------------------------------------------------

  async getAssignmentStats(): Promise<AssignmentStatsDto> {
    interface StatusRow { status: string; cnt: bigint }

    const rows = await this.prisma.$queryRaw<StatusRow[]>(Prisma.sql`
      SELECT status::text AS status, COUNT(*)::bigint AS cnt
      FROM test_assignment
      GROUP BY status
    `);

    const byStatus = { pending: 0, in_progress: 0, completed: 0, overdue: 0, cancelled: 0 };
    let total = 0;
    for (const r of rows) {
      const count = Number(r.cnt);
      const key = r.status as keyof typeof byStatus;
      if (key in byStatus) byStatus[key] = count;
      total += count;
    }

    // «Активные» = pending + in_progress + overdue (назначения, которые ещё не закрыты)
    const active = byStatus.pending + byStatus.in_progress + byStatus.overdue;
    const overduePercent = active > 0 ? Math.round((byStatus.overdue / active) * 10000) / 100 : 0;

    return { total, by_status: byStatus, overdue_percent: overduePercent };
  }

  // ---------------------------------------------------------------------------
  // GET /v1/reports/export?format=xlsx
  // Генерация Excel-книги с несколькими листами через exceljs.
  // ---------------------------------------------------------------------------

  async generateExport(dto: ExportQueryDto): Promise<Buffer> {
    const reportType = dto.report_type ?? ReportType.ALL;
    const coverageDto: CompetencyCoverageQueryDto = {
      department_id: dto.department_id,
      period_from: dto.period_from,
      period_to: dto.period_to,
    };
    const kpiDto: KpiProgressQueryDto = {
      department_id: dto.department_id,
      period_from: dto.period_from,
      period_to: dto.period_to,
    };

    const workbook = new ExcelJS.Workbook();
    workbook.creator = 'SAP BW Competency Assessment';
    workbook.created = new Date();

    if (reportType === ReportType.ALL || reportType === ReportType.COMPETENCY_COVERAGE) {
      const coverage = await this.getCompetencyCoverage(coverageDto);
      this.buildCoverageSheet(workbook, coverage.data);
    }

    if (reportType === ReportType.ALL || reportType === ReportType.KPI_PROGRESS) {
      const kpi = await this.getKpiProgress(kpiDto);
      this.buildKpiSheet(workbook, kpi.data);
    }

    if (reportType === ReportType.ALL) {
      const attempts = await this.getAttemptSummary(dto.department_id);
      this.buildAttemptsSheet(workbook, attempts);
    }

    const arrayBuffer = await workbook.xlsx.writeBuffer();
    return Buffer.from(arrayBuffer);
  }

  // ---------------------------------------------------------------------------
  // Private: attempt summary from certification_db (третий лист экспорта)
  // Агрегация по сотруднику — avg_score вычисляется как (total_score/max_score)*100.
  // ---------------------------------------------------------------------------

  private async getAttemptSummary(departmentId?: string): Promise<AttemptSummaryRow[]> {
    const employees = await this.prisma.employee.findMany({
      where: {
        isActive: true,
        ...(departmentId ? { departmentId } : {}),
      },
      select: { employeeId: true },
    });

    if (employees.length === 0) return [];

    const ids = employees.map((e) => e.employeeId);

    return this.certPrisma.$queryRaw<AttemptSummaryRow[]>(CertPrisma.sql`
      SELECT
        ta.employee_id::text                              AS employee_id,
        COUNT(*)                                          AS total_attempts,
        COUNT(*) FILTER (WHERE ta.status = 'completed')  AS completed_attempts,
        ROUND(AVG(
          CASE WHEN ta.max_score > 0
            THEN ta.total_score / ta.max_score * 100
          END
        ), 2)::float                                     AS avg_score,
        MAX(ta.finished_at)                              AS last_attempt_at
      FROM test_attempt ta
      WHERE ta.employee_id = ANY(${ids}::uuid[])
        AND ta.status IN ('completed', 'timed_out', 'cancelled')
      GROUP BY ta.employee_id
      ORDER BY ta.employee_id
    `);
  }

  // ---------------------------------------------------------------------------
  // Private: ExcelJS sheet builders
  // ---------------------------------------------------------------------------

  private buildCoverageSheet(
    workbook: ExcelJS.Workbook,
    data: GradeDistributionDto[],
  ): void {
    const sheet = workbook.addWorksheet('Покрытие компетенций');

    sheet.columns = [
      { header: 'Компетенция', key: 'competency_name', width: 40 },
      { header: 'K1', key: 'k1_count', width: 8 },
      { header: 'K2', key: 'k2_count', width: 8 },
      { header: 'K3', key: 'k3_count', width: 8 },
      { header: 'K4', key: 'k4_count', width: 8 },
      { header: 'K5', key: 'k5_count', width: 8 },
      { header: 'Всего', key: 'total_count', width: 10 },
    ];

    this.styleHeaderRow(sheet.getRow(1));
    data.forEach((row) => sheet.addRow(row));
    this.autoFilter(sheet, data.length);
  }

  private buildKpiSheet(workbook: ExcelJS.Workbook, data: KpiProgressItemDto[]): void {
    const sheet = workbook.addWorksheet('Прогресс KPI');

    sheet.columns = [
      { header: 'Компетенция', key: 'competency_name', width: 40 },
      { header: 'Целевой грейд', key: 'target_grade', width: 14 },
      { header: 'Целевой %', key: 'target_percent', width: 12 },
      { header: 'Период с', key: 'period_start', width: 12 },
      { header: 'Период по', key: 'period_end', width: 12 },
      { header: 'Сотрудников', key: 'total_employees', width: 13 },
      { header: 'Достигли', key: 'met_count', width: 11 },
      { header: 'Факт %', key: 'actual_percent', width: 10 },
      { header: 'Выполнен', key: 'is_on_track', width: 11 },
    ];

    this.styleHeaderRow(sheet.getRow(1));

    data.forEach((row) => {
      const excelRow = sheet.addRow({
        ...row,
        period_end: row.period_end ?? '—',
        is_on_track: row.is_on_track ? 'Да' : 'Нет',
      });

      // Подсветка по факту выполнения KPI
      excelRow.getCell('is_on_track').fill = {
        type: 'pattern',
        pattern: 'solid',
        fgColor: { argb: row.is_on_track ? 'FFD4EDDA' : 'FFF8D7DA' },
      };
    });

    this.autoFilter(sheet, data.length);
  }

  private buildAttemptsSheet(
    workbook: ExcelJS.Workbook,
    data: AttemptSummaryRow[],
  ): void {
    const sheet = workbook.addWorksheet('Попытки тестирования');

    sheet.columns = [
      { header: 'ID сотрудника', key: 'employee_id', width: 38 },
      { header: 'Всего попыток', key: 'total_attempts', width: 14 },
      { header: 'Завершено', key: 'completed_attempts', width: 12 },
      { header: 'Средний балл %', key: 'avg_score', width: 16 },
      { header: 'Последняя попытка', key: 'last_attempt_at', width: 22 },
    ];

    this.styleHeaderRow(sheet.getRow(1));

    data.forEach((row) => {
      sheet.addRow({
        employee_id: row.employee_id,
        total_attempts: Number(row.total_attempts),
        completed_attempts: Number(row.completed_attempts),
        avg_score: row.avg_score ?? '—',
        last_attempt_at: row.last_attempt_at
          ? row.last_attempt_at.toISOString().replace('T', ' ').slice(0, 19)
          : '—',
      });
    });

    this.autoFilter(sheet, data.length);
  }

  private styleHeaderRow(row: ExcelJS.Row): void {
    row.font = { bold: true, color: { argb: 'FFFFFFFF' } };
    row.fill = {
      type: 'pattern',
      pattern: 'solid',
      fgColor: { argb: 'FF2B5FA5' },
    };
    row.alignment = { vertical: 'middle', horizontal: 'center', wrapText: true };
    row.height = 30;
  }

  private autoFilter(sheet: ExcelJS.Worksheet, dataRows: number): void {
    if (dataRows === 0) return;
    sheet.autoFilter = {
      from: { row: 1, column: 1 },
      to: { row: dataRows + 1, column: sheet.columnCount },
    };
  }

  // ---------------------------------------------------------------------------
  // GET /v1/reports/department-heatmap
  // Средний грейд по матрице подразделение × компетенция. Для директора (UC-15).
  // ---------------------------------------------------------------------------

  async getDepartmentHeatmap() {
    interface HeatmapRow {
      department_id: string;
      department_name: string;
      competency_id: string;
      competency_name: string;
      avg_grade: number;
      employee_count: bigint;
    }

    const cells = await this.prisma.$queryRaw<HeatmapRow[]>(Prisma.sql`
      SELECT
        e.department_id::text            AS department_id,
        d.name                           AS department_name,
        cp.competency_id::text           AS competency_id,
        cp.competency_name               AS competency_name,
        AVG(CASE cp.grade::text
          WHEN 'K1' THEN 1.0 WHEN 'K2' THEN 2.0 WHEN 'K3' THEN 3.0
          WHEN 'K4' THEN 4.0 WHEN 'K5' THEN 5.0
        END)::float                      AS avg_grade,
        COUNT(*)::bigint                 AS employee_count
      FROM competency_profile cp
      JOIN employee e ON cp.employee_id = e.employee_id
      JOIN department d ON e.department_id = d.department_id
      WHERE cp.valid_to IS NULL AND e.is_active = true AND e.department_id IS NOT NULL
      GROUP BY e.department_id, d.name, cp.competency_id, cp.competency_name
      ORDER BY d.name, cp.competency_name
    `);

    const deptMap = new Map<string, string>();
    const compMap = new Map<string, string>();
    for (const c of cells) {
      deptMap.set(c.department_id, c.department_name);
      compMap.set(c.competency_id, c.competency_name);
    }

    return {
      departments: [...deptMap.entries()].map(([id, name]) => ({ id, name })),
      competencies: [...compMap.entries()].map(([id, name]) => ({ id, name })),
      cells: cells.map((c) => ({
        department_id: c.department_id,
        competency_id: c.competency_id,
        avg_grade: Number(c.avg_grade),
        employee_count: Number(c.employee_count),
      })),
    };
  }

  // ---------------------------------------------------------------------------
  // GET /v1/reports/grade-trend?months=12
  // Ежемесячное распределение грейдов за последние N месяцев (UC-15).
  // ---------------------------------------------------------------------------

  async getGradeTrend(months = 12) {
    interface TrendRow {
      month: string;
      k1: bigint; k2: bigint; k3: bigint; k4: bigint; k5: bigint;
    }

    const cutoff = new Date();
    cutoff.setMonth(cutoff.getMonth() - months);

    const rows = await this.prisma.$queryRaw<TrendRow[]>(Prisma.sql`
      SELECT
        to_char(date_trunc('month', cp.assessed_at), 'YYYY-MM')   AS month,
        COUNT(*) FILTER (WHERE cp.grade = 'K1')::bigint            AS k1,
        COUNT(*) FILTER (WHERE cp.grade = 'K2')::bigint            AS k2,
        COUNT(*) FILTER (WHERE cp.grade = 'K3')::bigint            AS k3,
        COUNT(*) FILTER (WHERE cp.grade = 'K4')::bigint            AS k4,
        COUNT(*) FILTER (WHERE cp.grade = 'K5')::bigint            AS k5
      FROM competency_profile cp
      JOIN employee e ON cp.employee_id = e.employee_id
      WHERE e.is_active = true AND cp.assessed_at >= ${cutoff}
      GROUP BY date_trunc('month', cp.assessed_at)
      ORDER BY month
    `);

    return {
      data: rows.map((r) => ({
        month: r.month,
        k1: Number(r.k1),
        k2: Number(r.k2),
        k3: Number(r.k3),
        k4: Number(r.k4),
        k5: Number(r.k5),
      })),
      months,
    };
  }

  // ---------------------------------------------------------------------------
  // GET /v1/reports/alerts
  // Критические события: просрочки, высокий K1, KPI не выполнены (UC-15).
  // ---------------------------------------------------------------------------

  async getAlerts() {
    type Severity = 'critical' | 'warning' | 'info';
    const alerts: { id: string; severity: Severity; title: string; description: string; category: string; value?: number }[] = [];

    const [overdueRow] = await this.prisma.$queryRaw<[{ cnt: bigint }]>(Prisma.sql`
      SELECT COUNT(*)::bigint AS cnt FROM test_assignment WHERE status = 'overdue'
    `);
    const overdueCount = Number(overdueRow.cnt);
    if (overdueCount > 0) {
      alerts.push({
        id: 'overdue-assignments',
        severity: overdueCount > 20 ? 'critical' : 'warning',
        title: `${overdueCount} просроченных назначений`,
        description: 'Сотрудники не завершили тесты в установленный срок',
        category: 'assignments',
        value: overdueCount,
      });
    }

    interface K1Row { name: string; k1_pct: number }
    const k1Rows = await this.prisma.$queryRaw<K1Row[]>(Prisma.sql`
      SELECT
        cp.competency_name AS name,
        ROUND(
          COUNT(*) FILTER (WHERE cp.grade = 'K1')::decimal
          / NULLIF(COUNT(*), 0) * 100, 1
        )::float AS k1_pct
      FROM competency_profile cp
      JOIN employee e ON cp.employee_id = e.employee_id
      WHERE cp.valid_to IS NULL AND e.is_active = true
      GROUP BY cp.competency_name
      HAVING COUNT(*) FILTER (WHERE cp.grade = 'K1')::decimal
             / NULLIF(COUNT(*), 0) > 0.4
      ORDER BY k1_pct DESC LIMIT 5
    `);
    for (const row of k1Rows) {
      alerts.push({
        id: `k1-high-${row.name.replace(/\s+/g, '-')}`,
        severity: row.k1_pct > 60 ? 'critical' : 'warning',
        title: `Критический K1: ${row.name}`,
        description: `${row.k1_pct}% сотрудников на начальном грейде — требуется развитие`,
        category: 'competency',
        value: row.k1_pct,
      });
    }

    const kpiData = await this.getKpiProgress({});
    const failedKpi = kpiData.data.filter((k) => !k.is_on_track);
    if (failedKpi.length > 0) {
      const names = failedKpi.slice(0, 3).map((k) => k.competency_name).join(', ');
      alerts.push({
        id: 'kpi-not-on-track',
        severity: failedKpi.length > 3 ? 'critical' : 'warning',
        title: `${failedKpi.length} KPI не достигают цели`,
        description: names + (failedKpi.length > 3 ? ' и др.' : ''),
        category: 'kpi',
        value: failedKpi.length,
      });
    }

    const [pendingRow] = await this.prisma.$queryRaw<[{ cnt: bigint }]>(Prisma.sql`
      SELECT COUNT(*)::bigint AS cnt FROM test_assignment WHERE status = 'pending'
    `);
    const pendingCount = Number(pendingRow.cnt);
    if (pendingCount > 0) {
      alerts.push({
        id: 'pending-assignments',
        severity: 'info',
        title: `${pendingCount} назначений ожидают начала`,
        description: 'Сотрудники ещё не приступили к назначенным тестам',
        category: 'assignments',
        value: pendingCount,
      });
    }

    return {
      alerts,
      critical_count: alerts.filter((a) => a.severity === 'critical').length,
      warning_count: alerts.filter((a) => a.severity === 'warning').length,
      generated_at: new Date().toISOString(),
    };
  }
}
