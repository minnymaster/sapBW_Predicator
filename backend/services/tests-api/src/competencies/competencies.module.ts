import { Module } from '@nestjs/common';
import { CompetenciesService } from './competencies.service';
import { CompetenciesController } from './competencies.controller';

@Module({
  controllers: [CompetenciesController],
  providers: [CompetenciesService],
  exports: [CompetenciesService],
})
export class CompetenciesModule {}
