import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { coursesApi } from '../lib/axios';
import type {
  Course,
  PaginatedCourses,
  CreateCourseDto,
  CreateMaterialDto,
  UploadResult,
} from '../types/courses';

// ─── Courses ──────────────────────────────────────────────────────────────────

export interface CoursesFilter {
  status?: string;
  page?: number;
  limit?: number;
}

export function useCourses(filter: CoursesFilter = {}) {
  return useQuery({
    queryKey: ['courses', filter],
    queryFn: () =>
      coursesApi
        .get<PaginatedCourses>('/v1/courses', { params: filter })
        .then((r) => r.data),
    staleTime: 1000 * 60 * 3,
  });
}

export function useCourse(id: string | null) {
  return useQuery({
    queryKey: ['courses', id],
    queryFn: () =>
      coursesApi.get<Course>(`/v1/courses/${id}`).then((r) => r.data),
    enabled: !!id,
    staleTime: 1000 * 60 * 2,
  });
}

export function useCreateCourse() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (dto: CreateCourseDto) =>
      coursesApi.post<Course>('/v1/courses', dto).then((r) => r.data),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['courses'] }),
  });
}

export function useUpdateCourse() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ id, dto }: { id: string; dto: Partial<CreateCourseDto> }) =>
      coursesApi.put<Course>(`/v1/courses/${id}`, dto).then((r) => r.data),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['courses'] }),
  });
}

export function useDeleteCourse() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (id: string) => coursesApi.delete(`/v1/courses/${id}`),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['courses'] }),
  });
}

// ─── Materials ────────────────────────────────────────────────────────────────

export function useCreateMaterial() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (dto: CreateMaterialDto) =>
      coursesApi.post('/v1/materials', dto).then((r) => r.data),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['courses'] }),
  });
}

export function useDeleteMaterial() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (id: string) => coursesApi.delete(`/v1/materials/${id}`),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['courses'] }),
  });
}

// ─── File upload ──────────────────────────────────────────────────────────────

export function useUploadFile() {
  return useMutation({
    mutationFn: (file: File) => {
      const form = new FormData();
      form.append('file', file);
      return coursesApi
        .post<UploadResult>('/v1/upload', form, {
          headers: { 'Content-Type': 'multipart/form-data' },
        })
        .then((r) => r.data);
    },
  });
}
