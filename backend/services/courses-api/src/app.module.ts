import { Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { PrismaModule } from './prisma/prisma.module';
import { KeysModule } from './auth/keys.module';
import { AuthModule } from './auth/auth.module';
import { CoursesModule } from './courses/courses.module';
import { MaterialsModule } from './materials/materials.module';

@Module({
  imports: [
    ConfigModule.forRoot({ isGlobal: true }),
    PrismaModule,
    KeysModule,    // глобальный — KeysService (RSA public key) доступен везде
    AuthModule,
    CoursesModule,
    MaterialsModule,
  ],
})
export class AppModule {}
