import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { manageApi } from '../lib/axios';
import type { KpiTarget, CreateKpiDto } from '../types/director';

export function useKpiTargets() {
  return useQuery({
    queryKey: ['kpi-targets'],
    queryFn: () => manageApi.get<KpiTarget[]>('/v1/kpi').then((r) => r.data),
    staleTime: 1000 * 60 * 3,
  });
}

export function useCreateKpi() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (dto: CreateKpiDto) =>
      manageApi.post<KpiTarget>('/v1/kpi', dto).then((r) => r.data),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['kpi-targets'] }),
  });
}

export function useUpdateKpi() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ id, dto }: { id: string; dto: Partial<CreateKpiDto> }) =>
      manageApi.put<KpiTarget>(`/v1/kpi/${id}`, dto).then((r) => r.data),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['kpi-targets'] }),
  });
}

export function useDeleteKpi() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (id: string) => manageApi.delete(`/v1/kpi/${id}`),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['kpi-targets'] }),
  });
}

export function useCompetencies() {
  return useQuery({
    queryKey: ['competencies'],
    queryFn: () =>
      manageApi
        .get<{ competencyId: string; name: string; area: string }[]>('/v1/competencies')
        .then((r) => r.data),
    staleTime: 1000 * 60 * 10,
  });
}

export function useDepartments() {
  return useQuery({
    queryKey: ['departments'],
    queryFn: () =>
      manageApi
        .get<{ departmentId: string; name: string }[]>('/v1/departments')
        .then((r) => r.data),
    staleTime: 1000 * 60 * 10,
  });
}
