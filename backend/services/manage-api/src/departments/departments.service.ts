import { Injectable } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';

export interface DepartmentItem {
  departmentId: string;
  name: string;
  parentId: string | null;
  headEmployeeId: string | null;
  _count?: { employees: number };
}

@Injectable()
export class DepartmentsService {
  constructor(private readonly prisma: PrismaService) {}

  async findAll(): Promise<DepartmentItem[]> {
    const depts = await this.prisma.department.findMany({
      select: {
        departmentId: true,
        name: true,
        parentId: true,
        headEmployeeId: true,
        _count: { select: { employees: { where: { isActive: true } } } },
      },
      orderBy: { name: 'asc' },
    });

    return depts.map((d) => ({
      departmentId: d.departmentId,
      name: d.name,
      parentId: d.parentId,
      headEmployeeId: d.headEmployeeId,
      employeeCount: d._count.employees,
    })) as DepartmentItem[];
  }
}
