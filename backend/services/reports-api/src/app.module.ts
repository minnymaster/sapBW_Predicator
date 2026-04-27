import { Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { PrismaModule } from './prisma/prisma.module';
import { CertificationPrismaModule } from './prisma/certification-prisma.module';
import { AuthModule } from './auth/auth.module';
import { ReportsModule } from './reports/reports.module';

@Module({
  imports: [
    ConfigModule.forRoot({ isGlobal: true }),
    PrismaModule,               // company_db — глобально
    CertificationPrismaModule,  // certification_db — глобально (только чтение)
    AuthModule,
    ReportsModule,
  ],
})
export class AppModule {}
