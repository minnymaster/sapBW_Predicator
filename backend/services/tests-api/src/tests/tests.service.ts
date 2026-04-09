import { Injectable, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { CreateTestDto } from './dto/create-test.dto';

@Injectable()
export class TestsService {
  constructor(private readonly prisma: PrismaService) {}

  findAll() {
    return this.prisma.test.findMany({
      where: { isActive: true },
      include: { _count: { select: { testQuestions: true } } },
      orderBy: { createdAt: 'desc' },
    });
  }

  async findOne(testId: string) {
    const test = await this.prisma.test.findUnique({
      where: { testId },
      include: {
        testQuestions: {
          orderBy: { orderNumber: 'asc' },
          include: {
            question: {
              include: { answerOptions: { orderBy: { orderNumber: 'asc' } } },
            },
          },
        },
      },
    });
    if (!test) throw new NotFoundException(`Test ${testId} not found`);
    return test;
  }

  create(dto: CreateTestDto, createdBy: string) {
    return this.prisma.test.create({
      data: { ...dto, createdBy },
    });
  }

  async addQuestion(testId: string, questionId: string, orderNumber: number) {
    await this.findOne(testId);
    return this.prisma.testQuestion.create({
      data: { testId, questionId, orderNumber },
    });
  }

  async removeQuestion(testId: string, questionId: string) {
    await this.findOne(testId);
    return this.prisma.testQuestion.delete({
      where: { testId_questionId: { testId, questionId } },
    });
  }

  async activate(testId: string) {
    await this.findOne(testId);
    return this.prisma.test.update({
      where: { testId },
      data: { isActive: true },
    });
  }
}
