import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { useNavigate } from 'react-router-dom';
import { learningApi } from '../lib/axios';
import type {
  TestListItem,
  StartAttemptResponse,
  NextQuestionResponse,
  SubmitAnswerRequest,
  SubmitAnswerResponse,
  FinishAttemptResponse,
  Competency,
} from '../types/tests';

export function useTests() {
  return useQuery({
    queryKey: ['tests'],
    queryFn: () => learningApi.get<TestListItem[]>('/v1/tests').then((r) => r.data),
  });
}

export function useCompetencies() {
  return useQuery({
    queryKey: ['competencies'],
    queryFn: () => learningApi.get<Competency[]>('/v1/competencies').then((r) => r.data),
    staleTime: 1000 * 60 * 30,
  });
}

export function useStartTest() {
  const navigate = useNavigate();
  return useMutation({
    mutationFn: (testId: string) =>
      learningApi.post<StartAttemptResponse>(`/v1/tests/${testId}/start`).then((r) => r.data),
    onSuccess: (data) => {
      navigate(`/tests/attempt/${data.attempt_id}`);
    },
  });
}

export function useNextQuestion(attemptId: string) {
  return useQuery({
    queryKey: ['attempt', attemptId, 'question'],
    queryFn: () =>
      learningApi
        .get<NextQuestionResponse>(`/v1/attempts/${attemptId}/next-question`)
        .then((r) => r.data),
    // Do not auto-refetch — only refetch explicitly after answer submission
    refetchOnWindowFocus: false,
    refetchInterval: false,
  });
}

export function useSubmitAnswer(attemptId: string) {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (dto: SubmitAnswerRequest) =>
      learningApi
        .post<SubmitAnswerResponse>(`/v1/attempts/${attemptId}/answer`, dto)
        .then((r) => r.data),
    onSuccess: () => {
      // Re-fetch next question (assumes backend increments currentQuestionIndex in submitAnswer)
      queryClient.invalidateQueries({ queryKey: ['attempt', attemptId, 'question'] });
    },
  });
}

export function useFinishAttempt(attemptId: string) {
  const navigate = useNavigate();
  return useMutation({
    mutationFn: () =>
      learningApi
        .post<FinishAttemptResponse>(`/v1/attempts/${attemptId}/finish`)
        .then((r) => r.data),
    onSuccess: (data) => {
      navigate(`/tests/attempt/${attemptId}/results`, { state: { result: data } });
    },
  });
}
