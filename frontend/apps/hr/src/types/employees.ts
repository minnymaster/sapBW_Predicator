export interface Employee {
  employeeId: string;
  fullName: string;
  email: string;
  role: string;
  position: string | null;
  departmentId: string | null;
  isActive: boolean;
}

export interface PaginatedEmployees {
  data: Employee[];
  total: number;
  page: number;
  limit: number;
}

export interface Department {
  departmentId: string;
  name: string;
  parentId: string | null;
  headEmployeeId: string | null;
  employeeCount: number;
}
