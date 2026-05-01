import { Injectable, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { CreateKpiDto } from './dto/create-kpi.dto';

@Injectable()
export class KpiService {
  constructor(private readonly prisma: PrismaService) {}

  async findAll() {
    const kpis = await this.prisma.targetKpi.findMany({
      include: { department: { select: { name: true } } },
      orderBy: [{ periodStart: 'desc' }, { competencyName: 'asc' }],
    });
    return kpis.map((k) => ({
      kpiId: k.kpiId,
      departmentId: k.departmentId,
      departmentName: k.department?.name ?? null,
      competencyId: k.competencyId,
      competencyName: k.competencyName,
      targetGrade: k.targetGrade,
      targetPercent: Number(k.targetPercent),
      periodStart: k.periodStart.toISOString().split('T')[0],
      periodEnd: k.periodEnd ? k.periodEnd.toISOString().split('T')[0] : null,
      createdAt: k.createdAt,
      updatedAt: k.updatedAt,
    }));
  }

  async create(dto: CreateKpiDto, setBy: string) {
    const kpi = await this.prisma.targetKpi.create({
      data: {
        departmentId: dto.departmentId ?? null,
        competencyId: dto.competencyId,
        competencyName: dto.competencyName,
        targetGrade: dto.targetGrade,
        targetPercent: dto.targetPercent,
        setBy,
        periodStart: new Date(dto.periodStart),
        periodEnd: dto.periodEnd ? new Date(dto.periodEnd) : null,
      },
      include: { department: { select: { name: true } } },
    });
    return {
      kpiId: kpi.kpiId,
      departmentId: kpi.departmentId,
      departmentName: kpi.department?.name ?? null,
      competencyId: kpi.competencyId,
      competencyName: kpi.competencyName,
      targetGrade: kpi.targetGrade,
      targetPercent: Number(kpi.targetPercent),
      periodStart: kpi.periodStart.toISOString().split('T')[0],
      periodEnd: kpi.periodEnd ? kpi.periodEnd.toISOString().split('T')[0] : null,
      createdAt: kpi.createdAt,
    };
  }

  async update(id: string, dto: Partial<CreateKpiDto>) {
    const existing = await this.prisma.targetKpi.findUnique({ where: { kpiId: id } });
    if (!existing) throw new NotFoundException(`KPI ${id} not found`);

    const kpi = await this.prisma.targetKpi.update({
      where: { kpiId: id },
      data: {
        ...(dto.departmentId !== undefined ? { departmentId: dto.departmentId ?? null } : {}),
        ...(dto.competencyId ? { competencyId: dto.competencyId } : {}),
        ...(dto.competencyName ? { competencyName: dto.competencyName } : {}),
        ...(dto.targetGrade ? { targetGrade: dto.targetGrade } : {}),
        ...(dto.targetPercent !== undefined ? { targetPercent: dto.targetPercent } : {}),
        ...(dto.periodStart ? { periodStart: new Date(dto.periodStart) } : {}),
        ...(dto.periodEnd !== undefined
          ? { periodEnd: dto.periodEnd ? new Date(dto.periodEnd) : null }
          : {}),
      },
      include: { department: { select: { name: true } } },
    });

    return {
      kpiId: kpi.kpiId,
      departmentId: kpi.departmentId,
      departmentName: kpi.department?.name ?? null,
      competencyId: kpi.competencyId,
      competencyName: kpi.competencyName,
      targetGrade: kpi.targetGrade,
      targetPercent: Number(kpi.targetPercent),
      periodStart: kpi.periodStart.toISOString().split('T')[0],
      periodEnd: kpi.periodEnd ? kpi.periodEnd.toISOString().split('T')[0] : null,
      updatedAt: kpi.updatedAt,
    };
  }

  async delete(id: string): Promise<void> {
    const existing = await this.prisma.targetKpi.findUnique({ where: { kpiId: id } });
    if (!existing) throw new NotFoundException(`KPI ${id} not found`);
    await this.prisma.targetKpi.delete({ where: { kpiId: id } });
  }
}
