import { Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { PrismaModule } from './prisma/prisma.module';
import { KeysModule } from './auth/keys.module';
import { AuthModule } from './auth/auth.module';

@Module({
  imports: [
    ConfigModule.forRoot({ isGlobal: true }),
    PrismaModule,
    KeysModule,   // глобальный — KeysService доступен везде, в т.ч. в JwtModule
    AuthModule,
  ],
})
export class AppModule {}
