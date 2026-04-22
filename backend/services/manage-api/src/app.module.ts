import { Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { PrismaModule } from './prisma/prisma.module';
import { KeysModule } from './auth/keys.module';
import { AuthModule } from './auth/auth.module';
import { QuestionsModule } from './questions/questions.module';

@Module({
  imports: [
    ConfigModule.forRoot({ isGlobal: true }),
    PrismaModule,
    KeysModule,   // глобальный — KeysService доступен везде, в т.ч. в JwtModule
    AuthModule,
    QuestionsModule,
  ],
})
export class AppModule {}
