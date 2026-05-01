// ─── Heatmap ──────────────────────────────────────────────────────────────────

export interface HeatmapDept { id: string; name: string }
export interface HeatmapComp { id: string; name: string }
export interface HeatmapCell {
  department_id: string;
  competency_id: string;
  avg_grade: number;
  employee_count: number;
}
export interface HeatmapResponse {
  departments: HeatmapDept[];
  competencies: HeatmapComp[];
  cells: HeatmapCell[];
}

// ─── Grade trend ──────────────────────────────────────────────────────────────

export interface GradeTrendPoint {
  month: string;
  k1: number;
  k2: number;
  k3: number;
  k4: number;
  k5: number;
}
export interface GradeTrendResponse {
  data: GradeTrendPoint[];
  months: number;
}

// ─── Alerts ───────────────────────────────────────────────────────────────────

export type AlertSeverity = 'critical' | 'warning' | 'info';

export interface Alert {
  id: string;
  severity: AlertSeverity;
  title: string;
  description: string;
  category: string;
  value?: number;
}
export interface AlertsResponse {
  alerts: Alert[];
  critical_count: number;
  warning_count: number;
  generated_at: string;
}

// ─── KPI targets ─────────────────────────────────────────────────────────────

export type CompetencyGrade = 'K1' | 'K2' | 'K3' | 'K4' | 'K5';

export interface KpiTarget {
  kpiId: string;
  departmentId: string | null;
  departmentName: string | null;
  competencyId: string;
  competencyName: string;
  targetGrade: CompetencyGrade;
  targetPercent: number;
  periodStart: string;
  periodEnd: string | null;
  createdAt?: string;
  updatedAt?: string;
}

export interface CreateKpiDto {
  departmentId?: string;
  competencyId: string;
  competencyName: string;
  targetGrade: CompetencyGrade;
  targetPercent: number;
  periodStart: string;
  periodEnd?: string;
}

// ─── KPI progress (from existing reports endpoint) ────────────────────────────

export interface KpiProgressItem {
  kpi_id: string;
  competency_id: string;
  competency_name: string;
  target_grade: string;
  target_percent: number;
  period_start: string;
  period_end: string | null;
  total_employees: number;
  met_count: number;
  actual_percent: number;
  is_on_track: boolean;
}

export interface KpiProgressResponse {
  data: KpiProgressItem[];
  total: number;
  department_id: string | null;
}

// ─── Assignment stats ─────────────────────────────────────────────────────────

export interface AssignmentStats {
  total: number;
  by_status: {
    pending: number;
    in_progress: number;
    completed: number;
    overdue: number;
    cancelled: number;
  };
  overdue_percent: number;
}
