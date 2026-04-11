import {
  Body, Controller, Get, Param, ParseUUIDPipe, Post, UseGuards,
} from '@nestjs/common';
import { AuthGuard } from '@nestjs/passport';
import { ApiBearerAuth, ApiOperation, ApiTags } from '@nestjs/swagger';
import { CompetenciesService } from './competencies.service';
import { QuestionsService } from '../questions/questions.service';
import { GenerateQuestionsDto } from './dto/generate-questions.dto';
import { CurrentUser, Roles } from '../auth/decorators';
import { RolesGuard } from '../auth/roles.guard';
import { JwtPayload } from '../auth/jwt.strategy';

@ApiTags('competencies')
@ApiBearerAuth()
@UseGuards(AuthGuard('jwt'))
@Controller('competencies')
export class CompetenciesController {
  constructor(
    private readonly svc: CompetenciesService,
    private readonly questionsSvc: QuestionsService,
  ) {}

  @Get()
  findAll() {
    return this.svc.findAll();
  }

  @Get(':id')
  findOne(@Param('id', ParseUUIDPipe) id: string) {
    return this.svc.findOne(id);
  }

  /**
   * UC-08: сгенерировать вопросы для компетенции через LLM — только роль hr.
   * competencyId берётся из URL-параметра :id.
   * PROMPT_GENERATE_QUESTIONS — см. llm.service.ts
   */
  @Post(':id/generate-questions')
  @UseGuards(RolesGuard)
  @Roles('hr')
  @ApiOperation({ summary: 'UC-08: генерация вопросов LLM для компетенции [hr]' })
  generateQuestions(
    @Param('id', ParseUUIDPipe) id: string,
    @Body() dto: GenerateQuestionsDto,
    @CurrentUser() user: JwtPayload,
  ) {
    return this.questionsSvc.generateViaLlm(
      { competencyId: id, type: dto.type, difficulty: dto.difficulty, count: dto.count },
      user.sub,
    );
  }
}
