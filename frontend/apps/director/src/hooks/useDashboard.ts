import { useQuery } from '@tanstack/react-query';
import { analyticsApi } from '../lib/axios';
import type {
  HeatmapResponse,
  GradeTrendResponse,
  AlertsResponse,
  KpiProgressResponse,
  AssignmentStats,
} from '../types/director';

export function useHeatmap() {
  return useQuery({
    queryKey: ['reports', 'department-heatmap'],
    queryFn: () =>
      analyticsApi.get<HeatmapResponse>('/v1/reports/department-heatmap').then((r) => r.data),
    staleTime: 1000 * 60 * 5,
  });
}

export function useGradeTrend(months = 12) {
  return useQuery({
    queryKey: ['reports', 'grade-trend', months],
    queryFn: () =>
      analyticsApi
        .get<GradeTrendResponse>('/v1/reports/grade-trend', { params: { months } })
        .then((r) => r.data),
    staleTime: 1000 * 60 * 5,
  });
}

export function useAlerts() {
  return useQuery({
    queryKey: ['reports', 'alerts'],
    queryFn: () =>
      analyticsApi.get<AlertsResponse>('/v1/reports/alerts').then((r) => r.data),
    staleTime: 1000 * 60 * 2,
  });
}

export function useKpiProgress(departmentId?: string) {
  return useQuery({
    queryKey: ['reports', 'kpi-progress', departmentId],
    queryFn: () =>
      analyticsApi
        .get<KpiProgressResponse>('/v1/reports/kpi-progress', {
          params: departmentId ? { department_id: departmentId } : {},
        })
        .then((r) => r.data),
    staleTime: 1000 * 60 * 5,
  });
}

export function useAssignmentStats() {
  return useQuery({
    queryKey: ['reports', 'assignment-stats'],
    queryFn: () =>
      analyticsApi.get<AssignmentStats>('/v1/reports/assignment-stats').then((r) => r.data),
    staleTime: 1000 * 60 * 5,
  });
}
