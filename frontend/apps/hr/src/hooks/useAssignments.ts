import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { manageApi } from '../lib/axios';
import type { Employee, PaginatedEmployees, Department } from '../types/employees';
import type { PaginatedQuestions } from '../types/questions';

// ─── Employees ────────────────────────────────────────────────────────────────

export interface EmployeesFilter {
  search?: string;
  departmentId?: string;
  page?: number;
  limit?: number;
}

export function useEmployees(filter: EmployeesFilter = {}) {
  return useQuery({
    queryKey: ['employees', filter],
    queryFn: () =>
      manageApi
        .get<PaginatedEmployees>('/v1/employees', { params: filter })
        .then((r) => r.data),
    staleTime: 1000 * 60 * 5,
  });
}

export function useDepartments() {
  return useQuery({
    queryKey: ['departments'],
    queryFn: () =>
      manageApi.get<Department[]>('/v1/departments').then((r) => r.data),
    staleTime: 1000 * 60 * 10,
  });
}

// ─── Tests (for assignment selector) ─────────────────────────────────────────

export interface TestItem {
  testId: string;
  title: string;
  isActive: boolean;
  questionCount: number;
}

export function useTests() {
  return useQuery({
    queryKey: ['tests', 'active'],
    queryFn: () =>
      manageApi
        .get<{ data: TestItem[]; total: number }>('/v1/tests', {
          params: { isActive: true, limit: 200 },
        })
        .then((r) => r.data),
    staleTime: 1000 * 60 * 5,
  });
}

// ─── Create assignment ────────────────────────────────────────────────────────

export interface CreateAssignmentDto {
  testId: string;
  employeeId?: string;
  departmentId?: string;
  dueDate?: string | null;
}

export interface AssignmentResult {
  assignmentId: string;
  employeeId: string;
  testId: string;
  status: string;
  deadline: string | null;
  assignedAt: string;
}

export function useCreateAssignment() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (dto: CreateAssignmentDto) =>
      manageApi
        .post<AssignmentResult[]>('/v1/assignments', dto)
        .then((r) => r.data),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['assignments'] }),
  });
}
