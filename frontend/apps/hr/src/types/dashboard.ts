// GET /v1/reports/competency-coverage
export interface GradeDistribution {
  competency_id: string;
  competency_name: string;
  k1_count: number;
  k2_count: number;
  k3_count: number;
  k4_count: number;
  k5_count: number;
  total_count: number;
}

export interface CompetencyCoverageResponse {
  data: GradeDistribution[];
  total: number;
  period_from: string | null;
  period_to: string | null;
  department_id: string | null;
}

// GET /v1/reports/kpi-progress
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

// GET /v1/reports/assignment-stats
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
