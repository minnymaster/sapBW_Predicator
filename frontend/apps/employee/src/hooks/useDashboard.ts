import { useMemo } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { learningApi } from '../lib/axios';
import type {
  EmployeeSummary,
  AttemptListItem,
  RecommendationItem,
  RecommendationStatus,
  TrendPoint,
  Grade,
} from '../types/dashboard';

export function useEmployeeSummary() {
  return useQuery({
    queryKey: ['dashboard', 'summary'],
    queryFn: () =>
      learningApi.get<EmployeeSummary>('/v1/dashboard/summary').then((r) => r.data),
    staleTime: 1000 * 60 * 5,
  });
}

export function useMyAttempts() {
  return useQuery({
    queryKey: ['attempts', 'my'],
    queryFn: () =>
      learningApi.get<AttemptListItem[]>('/v1/attempts').then((r) => r.data),
  });
}

export function useMyRecommendations() {
  return useQuery({
    queryKey: ['recommendations', 'my'],
    queryFn: () =>
      learningApi.get<RecommendationItem[]>('/v1/recommendations/me').then((r) => r.data),
  });
}

export function useUpdateRecommendationStatus() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: ({ id, status }: { id: string; status: RecommendationStatus }) =>
      learningApi
        .patch<RecommendationItem>(`/v1/recommendations/${id}/status`, { status })
        .then((r) => r.data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['recommendations', 'my'] });
    },
  });
}

// Derives a 6-month trend from the attempts list (client-side aggregation).
// Returns TrendPoint[] sorted oldest → newest, one point per calendar month.
export function useSixMonthTrend(attempts: AttemptListItem[] | undefined): TrendPoint[] {
  return useMemo(() => {
    const now = new Date();
    const months: TrendPoint[] = [];

    for (let i = 5; i >= 0; i--) {
      const d = new Date(now.getFullYear(), now.getMonth() - i, 1);
      const label = d.toLocaleDateString('ru-RU', { month: 'short' });

      const point: TrendPoint = { month: label };
      const buckets: Record<string, number[]> = {};

      if (attempts) {
        for (const att of attempts) {
          if (att.status !== 'completed' || !att.finishedAt) continue;
          const fd = new Date(att.finishedAt);
          if (fd.getFullYear() !== d.getFullYear() || fd.getMonth() !== d.getMonth()) continue;
          for (const cr of att.competencyResults) {
            (buckets[cr.competency_name] ??= []).push(cr.score_percent);
          }
        }
      }

      for (const [name, scores] of Object.entries(buckets)) {
        point[name] = Math.round(scores.reduce((a, b) => a + b, 0) / scores.length);
      }

      months.push(point);
    }

    return months;
  }, [attempts]);
}

// Converts score_percent → Grade, matching backend thresholds in attempts.service.ts
export function scoreToGrade(pct: number): Grade {
  if (pct > 80) return 'K5';
  if (pct > 60) return 'K4';
  if (pct > 40) return 'K3';
  if (pct > 20) return 'K2';
  return 'K1';
}
