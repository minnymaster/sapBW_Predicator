import { Module } from '@nestjs/common';
import { AuthModule } from '../auth/auth.module';
import { RolesGuard } from '../auth/roles.guard';
import { UploadController } from './upload.controller';

@Module({
  imports: [AuthModule],
  controllers: [UploadController],
  providers: [RolesGuard],
})
export class UploadModule {}
