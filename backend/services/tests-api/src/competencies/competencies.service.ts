import { Injectable, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { Prisma } from '../../generated/prisma';

@Injectable()
export class CompetenciesService {
  constructor(private readonly prisma: PrismaService) {}

  findAll() {
    return this.prisma.competency.findMany({
      where: { isActive: true },
      orderBy: [{ area: 'asc' }, { name: 'asc' }],
    });
  }

  async findOne(competencyId: string) {
    const competency = await this.prisma.competency.findUnique({
      where: { competencyId },
    });
    if (!competency) throw new NotFoundException(`Competency ${competencyId} not found`);
    return competency;
  }

  create(data: Prisma.CompetencyCreateInput) {
    return this.prisma.competency.create({ data });
  }

  async update(competencyId: string, data: Prisma.CompetencyUpdateInput) {
    await this.findOne(competencyId);
    return this.prisma.competency.update({ where: { competencyId }, data });
  }
}
