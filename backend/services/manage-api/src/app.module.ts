import { Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { PrismaModule } from './prisma/prisma.module';
import { CertificationPrismaModule } from './prisma/certification-prisma.module';
import { KeysModule } from './auth/keys.module';
import { AuthModule } from './auth/auth.module';
import { RedisModule } from './redis/redis.module';
import { QuestionsModule } from './questions/questions.module';
import { TestsModule } from './tests/tests.module';
import { AssignmentsModule } from './assignments/assignments.module';
import { EmployeesModule } from './employees/employees.module';
import { DepartmentsModule } from './departments/departments.module';
import { KpiModule } from './kpi/kpi.module';

@Module({
  imports: [
    ConfigModule.forRoot({ isGlobal: true }),
    PrismaModule,
    CertificationPrismaModule,
    KeysModule,
    RedisModule,
    AuthModule,
    QuestionsModule,
    TestsModule,
    AssignmentsModule,
    EmployeesModule,
    DepartmentsModule,
    KpiModule,
  ],
})
export class AppModule {}
