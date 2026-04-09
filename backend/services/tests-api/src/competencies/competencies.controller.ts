import { Controller, Get, Param, ParseUUIDPipe, UseGuards } from '@nestjs/common';
import { AuthGuard } from '@nestjs/passport';
import { ApiBearerAuth, ApiTags } from '@nestjs/swagger';
import { CompetenciesService } from './competencies.service';

@ApiTags('competencies')
@ApiBearerAuth()
@UseGuards(AuthGuard('jwt'))
@Controller('competencies')
export class CompetenciesController {
  constructor(private readonly svc: CompetenciesService) {}

  @Get()
  findAll() {
    return this.svc.findAll();
  }

  @Get(':id')
  findOne(@Param('id', ParseUUIDPipe) id: string) {
    return this.svc.findOne(id);
  }
}
