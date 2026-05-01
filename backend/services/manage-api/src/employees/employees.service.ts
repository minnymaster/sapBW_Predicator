import { Injectable } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';

export interface EmployeeItem {
  employeeId: string;
  fullName: string;
  email: string;
  role: string;
  position: string | null;
  departmentId: string | null;
  isActive: boolean;
}

export interface PaginatedEmployees {
  data: EmployeeItem[];
  total: number;
  page: number;
  limit: number;
}

export interface QueryEmployeesDto {
  search?: string;
  departmentId?: string;
  page?: number;
  limit?: number;
}

@Injectable()
export class EmployeesService {
  constructor(private readonly prisma: PrismaService) {}

  async findAll(query: QueryEmployeesDto): Promise<PaginatedEmployees> {
    const page = query.page ?? 1;
    const limit = Math.min(query.limit ?? 50, 200);
    const skip = (page - 1) * limit;

    const where = {
      isActive: true,
      ...(query.departmentId ? { departmentId: query.departmentId } : {}),
      ...(query.search
        ? {
            OR: [
              { fullName: { contains: query.search, mode: 'insensitive' as const } },
              { email: { contains: query.search, mode: 'insensitive' as const } },
            ],
          }
        : {}),
    };

    const [employees, total] = await this.prisma.$transaction([
      this.prisma.employee.findMany({
        where,
        select: {
          employeeId: true,
          fullName: true,
          email: true,
          role: true,
          position: true,
          departmentId: true,
          isActive: true,
        },
        orderBy: { fullName: 'asc' },
        skip,
        take: limit,
      }),
      this.prisma.employee.count({ where }),
    ]);

    return { data: employees as EmployeeItem[], total, page, limit };
  }
}
