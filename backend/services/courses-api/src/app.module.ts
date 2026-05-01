import { Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { PrismaModule } from './prisma/prisma.module';
import { KeysModule } from './auth/keys.module';
import { AuthModule } from './auth/auth.module';
import { CoursesModule } from './courses/courses.module';
import { MaterialsModule } from './materials/materials.module';
import { UploadModule } from './upload/upload.module';

@Module({
  imports: [
    ConfigModule.forRoot({ isGlobal: true }),
    PrismaModule,
    KeysModule,
    AuthModule,
    CoursesModule,
    MaterialsModule,
    UploadModule,
  ],
})
export class AppModule {}
