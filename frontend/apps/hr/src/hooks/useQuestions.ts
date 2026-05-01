import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { manageApi } from '../lib/axios';
import type {
  Competency,
  CreateQuestionDto,
  GenerateQuestionsDto,
  PaginatedQuestions,
  UpdateQuestionDto,
} from '../types/questions';

export interface QuestionsFilter {
  competencyId?: string;
  difficulty?: string;
  page?: number;
  limit?: number;
}

export function useQuestions(filter: QuestionsFilter = {}) {
  return useQuery({
    queryKey: ['questions', filter],
    queryFn: () =>
      manageApi
        .get<PaginatedQuestions>('/v1/questions', {
          params: {
            ...(filter.competencyId ? { competencyId: filter.competencyId } : {}),
            ...(filter.difficulty ? { difficulty: filter.difficulty } : {}),
            page: filter.page ?? 1,
            limit: filter.limit ?? 25,
          },
        })
        .then((r) => r.data),
  });
}

export function useCreateQuestion() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (dto: CreateQuestionDto) =>
      manageApi.post('/v1/questions', dto).then((r) => r.data),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['questions'] }),
  });
}

export function useUpdateQuestion() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ id, dto }: { id: string; dto: UpdateQuestionDto }) =>
      manageApi.put(`/v1/questions/${id}`, dto).then((r) => r.data),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['questions'] }),
  });
}

export function useDeleteQuestion() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (id: string) => manageApi.delete(`/v1/questions/${id}`),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['questions'] }),
  });
}

export function useCompetencies() {
  return useQuery({
    queryKey: ['competencies'],
    queryFn: () =>
      manageApi.get<Competency[]>('/v1/competencies').then((r) => r.data),
    staleTime: 1000 * 60 * 10,
  });
}

export function useGenerateQuestions() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ competencyId, dto }: { competencyId: string; dto: GenerateQuestionsDto }) =>
      manageApi
        .post(`/v1/competencies/${competencyId}/generate-questions`, dto)
        .then((r) => r.data),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['questions'] }),
  });
}
