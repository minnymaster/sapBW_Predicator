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

@Module({
  imports: [
    ConfigModule.forRoot({ isGlobal: true }),
    PrismaModule,
    CertificationPrismaModule, // глобальный — CertificationPrismaService доступен везде
    KeysModule,                // глобальный — KeysService доступен везде (JwtModule)
    RedisModule,               // глобальный — RedisPublisherService доступен везде
    AuthModule,
    QuestionsModule,
    TestsModule,
    AssignmentsModule,
  ],
})
export class AppModule {}
