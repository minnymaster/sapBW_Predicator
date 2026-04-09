import {
  Body, Controller, Get, Param, ParseUUIDPipe,
  Post, Query, UseGuards,
} from '@nestjs/common';
import { AuthGuard } from '@nestjs/passport';
import { ApiBearerAuth, ApiTags } from '@nestjs/swagger';
import { QuestionsService } from './questions.service';
import { CreateQuestionDto } from './dto/create-question.dto';
import { GenerateQuestionDto } from './dto/generate-question.dto';
import { CurrentUser, Roles } from '../auth/decorators';
import { RolesGuard } from '../auth/roles.guard';
import { JwtPayload } from '../auth/jwt.strategy';

@ApiTags('questions')
@ApiBearerAuth()
@UseGuards(AuthGuard('jwt'), RolesGuard)
@Controller('questions')
export class QuestionsController {
  constructor(private readonly svc: QuestionsService) {}

  @Get()
  findByCompetency(@Query('competencyId', ParseUUIDPipe) competencyId: string) {
    return this.svc.findByCompetency(competencyId);
  }

  @Get(':id')
  findOne(@Param('id', ParseUUIDPipe) id: string) {
    return this.svc.findOne(id);
  }

  @Post()
  @Roles('hr')
  create(@Body() dto: CreateQuestionDto, @CurrentUser() user: JwtPayload) {
    return this.svc.create(dto, user.sub);
  }

  @Post('generate')
  @Roles('hr')
  generate(@Body() dto: GenerateQuestionDto, @CurrentUser() user: JwtPayload) {
    return this.svc.generateViaLlm(dto, user.sub);
  }

  @Post(':id/versions')
  @Roles('hr')
  createVersion(
    @Param('id', ParseUUIDPipe) id: string,
    @Body() dto: CreateQuestionDto,
    @CurrentUser() user: JwtPayload,
  ) {
    return this.svc.createVersion(id, dto, user.sub);
  }
}
