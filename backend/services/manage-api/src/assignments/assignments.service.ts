import {
  BadRequestException,
  Injectable,
  Logger,
  NotFoundException,
} from '@nestjs/common';
import { TestAssignment } from '../../generated/prisma';
import { CertificationPrismaService } from '../prisma/certification-prisma.service';
import { PrismaService } from '../prisma/prisma.service';
import {
  ASSIGNMENTS_CHANNEL,
  RedisPublisherService,
} from '../redis/redis-publisher.service';
import { AssignmentResponseDto } from './dto/assignment-response.dto';
import { CreateAssignmentDto } from './dto/create-assignment.dto';

interface AssignmentCreatedPayload {
  assignmentId: string;
  employeeId: string;
  testId: string;
  assignedBy: string;
  deadline: string | null;
  assignedAt: string;
}

@Injectable()
export class AssignmentsService {
  private readonly logger = new Logger(AssignmentsService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly certPrisma: CertificationPrismaService,
    private readonly redisPublisher: RedisPublisherService,
  ) {}

  // ---------------------------------------------------------------------------
  // POST /v1/assignments
  // employeeId → одно назначение; departmentId → по одному для каждого активного сотрудника.
  // Дублирующие назначения (pending/in_progress для того же теста) пропускаются.
  // После создания каждого назначения публикуется событие в Redis Pub/Sub.
  // ---------------------------------------------------------------------------

  async create(
    dto: CreateAssignmentDto,
    assignedBy: string,
  ): Promise<AssignmentResponseDto[]> {
    if (!dto.employeeId && !dto.departmentId) {
      throw new BadRequestException(
        'Either employeeId or departmentId must be provided',
      );
    }
    if (dto.employeeId && dto.departmentId) {
      throw new BadRequestException(
        'Provide either employeeId or departmentId, not both',
      );
    }

    // Проверяем, что тест существует и активен в certification_db
    const test = await this.certPrisma.test.findUnique({
      where: { testId: dto.testId },
      select: { testId: true, isActive: true },
    });
    if (!test) throw new NotFoundException(`Test ${dto.testId} not found`);
    if (!test.isActive) {
      throw new BadRequestException(`Test ${dto.testId} is not active`);
    }

    // Собираем список employeeId
    const employeeIds = await this.resolveEmployeeIds(dto);

    const deadline = dto.dueDate ? new Date(dto.dueDate) : null;

    // Транзакция: создаём назначения, пропуская дубли
    const created = await this.prisma.$transaction(async (tx) => {
      const results: TestAssignment[] = [];

      for (const employeeId of employeeIds) {
        const duplicate = await tx.testAssignment.findFirst({
          where: {
            employeeId,
            testId: dto.testId,
            status: { in: ['pending', 'in_progress'] },
          },
          select: { assignmentId: true },
        });
        if (duplicate) continue;

        const assignment = await tx.testAssignment.create({
          data: {
            employeeId,
            testId: dto.testId,
            assignedBy,
            deadline,
            status: 'pending',
          },
        });
        results.push(assignment);
      }

      return results;
    });

    // Публикуем событие assignment.created в Redis Pub/Sub для каждого назначения
    for (const a of created) {
      await this.redisPublisher.publish<AssignmentCreatedPayload>(
        ASSIGNMENTS_CHANNEL,
        {
          event: 'assignment.created',
          data: {
            assignmentId: a.assignmentId,
            employeeId: a.employeeId,
            testId: a.testId,
            assignedBy: a.assignedBy,
            deadline: a.deadline?.toISOString() ?? null,
            assignedAt: a.assignedAt.toISOString(),
          },
        },
      );
    }

    this.logger.log(
      `Created ${created.length} assignment(s) for testId=${dto.testId} by=${assignedBy}`,
    );

    return created.map((a) => this.mapToDto(a));
  }

  // ---------------------------------------------------------------------------
  // DELETE /v1/assignments/:id — отменить назначение (status=cancelled)
  // ---------------------------------------------------------------------------

  async delete(id: string): Promise<void> {
    const assignment = await this.prisma.testAssignment.findUnique({
      where: { assignmentId: id },
      select: { assignmentId: true, status: true },
    });

    if (!assignment) throw new NotFoundException(`Assignment ${id} not found`);

    if (assignment.status === 'completed' || assignment.status === 'overdue') {
      throw new BadRequestException(
        `Cannot cancel an assignment with status '${assignment.status}'`,
      );
    }

    if (assignment.status === 'cancelled') {
      throw new BadRequestException('Assignment is already cancelled');
    }

    await this.prisma.testAssignment.update({
      where: { assignmentId: id },
      data: { status: 'cancelled' },
    });

    this.logger.log(`Assignment cancelled: assignmentId=${id}`);
  }

  // ---------------------------------------------------------------------------
  // Helpers
  // ---------------------------------------------------------------------------

  private async resolveEmployeeIds(dto: CreateAssignmentDto): Promise<string[]> {
    if (dto.employeeId) {
      const emp = await this.prisma.employee.findUnique({
        where: { employeeId: dto.employeeId },
        select: { employeeId: true, isActive: true },
      });
      if (!emp) throw new NotFoundException(`Employee ${dto.employeeId} not found`);
      if (!emp.isActive) {
        throw new BadRequestException(`Employee ${dto.employeeId} is inactive`);
      }
      return [dto.employeeId];
    }

    const employees = await this.prisma.employee.findMany({
      where: { departmentId: dto.departmentId!, isActive: true },
      select: { employeeId: true },
    });
    if (employees.length === 0) {
      throw new NotFoundException(
        `No active employees found in department ${dto.departmentId}`,
      );
    }
    return employees.map((e) => e.employeeId);
  }

  private mapToDto(a: TestAssignment): AssignmentResponseDto {
    return {
      assignmentId: a.assignmentId,
      employeeId: a.employeeId,
      testId: a.testId,
      assignedBy: a.assignedBy,
      status: a.status,
      deadline: a.deadline,
      assignedAt: a.assignedAt,
      updatedAt: a.updatedAt,
    };
  }
}
