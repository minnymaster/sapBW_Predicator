export type Grade = 'K1' | 'K2' | 'K3' | 'K4' | 'K5';
export type AttemptStatus = 'in_progress' | 'completed' | 'expired';
export type RecommendationStatus = 'new' | 'in_progress' | 'completed';

// ─── /v1/dashboard/summary (employee-facing, tests-api UC-05) ────────────────

export interface CompetencyProgress {
  competency_id: string;
  competency_name: string;
  area: string;
  current_grade: Grade;
  score_percent: number;
}

export interface UpcomingTest {
  test_id: string;
  title: string;
  description: string | null;
  time_limit_sec: number | null;
  max_attempts: number;
  used_attempts: number;
  competency_name: string;
}

export interface EmployeeSummary {
  overall_grade: Grade;
  coverage_percent: number;
  competencies: CompetencyProgress[];
  upcoming_tests: UpcomingTest[];
  cached_at: string;
}

// ─── /v1/attempts (list of employee's own attempts, tests-api) ────────────────

export interface AttemptCompetencyResult {
  competency_id: string;
  competency_name: string;
  score: number;
  max_score: number;
  score_percent: number;
  grade: Grade;
}

export interface AttemptListItem {
  attemptId: string;
  testId: string;
  testTitle: string;
  status: AttemptStatus;
  totalScore: number | null;
  maxScore: number | null;
  gradeAchieved: Grade | null;
  startedAt: string;
  finishedAt: string | null;
  competencyResults: AttemptCompetencyResult[];
}

// ─── /v1/recommendations/me ──────────────────────────────────────────────────

export interface RecommendationItem {
  recommendationId: string;
  courseId: string;
  courseTitle: string;
  priority: number;
  explanation: string | null;
  status: RecommendationStatus;
  gap: {
    actualGrade: Grade;
    targetGrade: Grade;
    competency: {
      competencyId: string;
      name: string;
      area: string;
    };
  };
  createdAt: string;
}

// ─── Derived: trend chart ────────────────────────────────────────────────────

export type TrendPoint = {
  month: string;
  [competencyName: string]: number | string;
};
