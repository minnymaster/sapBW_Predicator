import { Global, Module } from '@nestjs/common';
import { CertificationPrismaService } from './certification-prisma.service';

@Global()
@Module({
  providers: [CertificationPrismaService],
  exports: [CertificationPrismaService],
})
export class CertificationPrismaModule {}
