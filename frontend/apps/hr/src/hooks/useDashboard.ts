import { useQuery } from '@tanstack/react-query';
import { analyticsApi } from '../lib/axios';
import type {
  AssignmentStats,
  CompetencyCoverageResponse,
  KpiProgressResponse,
} from '../types/dashboard';

export function useAssignmentStats() {
  return useQuery({
    queryKey: ['reports', 'assignment-stats'],
    queryFn: () =>
      analyticsApi.get<AssignmentStats>('/v1/reports/assignment-stats').then((r) => r.data),
    staleTime: 1000 * 60 * 5,
  });
}

export interface ReportParams {
  department_id?: string;
  period_from?: string;
  period_to?: string;
}

export function useCompetencyCoverage(params?: ReportParams) {
  return useQuery({
    queryKey: ['reports', 'competency-coverage', params],
    queryFn: () =>
      analyticsApi
        .get<CompetencyCoverageResponse>('/v1/reports/competency-coverage', { params })
        .then((r) => r.data),
    staleTime: 1000 * 60 * 5,
  });
}

export function useKpiProgress(params?: ReportParams) {
  return useQuery({
    queryKey: ['reports', 'kpi-progress', params],
    queryFn: () =>
      analyticsApi
        .get<KpiProgressResponse>('/v1/reports/kpi-progress', { params })
        .then((r) => r.data),
    staleTime: 1000 * 60 * 5,
  });
}
