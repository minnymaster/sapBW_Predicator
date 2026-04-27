import { Module } from '@nestjs/common';
import { AuthModule } from '../auth/auth.module';
import { RolesGuard } from '../auth/roles.guard';
import { MaterialsController } from './materials.controller';
import { MaterialsService } from './materials.service';

@Module({
  imports: [AuthModule],
  controllers: [MaterialsController],
  providers: [MaterialsService, RolesGuard],
})
export class MaterialsModule {}
