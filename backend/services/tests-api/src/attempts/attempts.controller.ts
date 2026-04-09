import {
  Body, Controller, Get, Param, ParseUUIDPipe, Patch, Post, UseGuards,
} from '@nestjs/common';
import { AuthGuard } from '@nestjs/passport';
import { ApiBearerAuth, ApiTags } from '@nestjs/swagger';
import { AttemptsService } from './attempts.service';
import { SubmitAnswerDto } from './dto/submit-answer.dto';
import { CurrentUser } from '../auth/decorators';
import { JwtPayload } from '../auth/jwt.strategy';

@ApiTags('attempts')
@ApiBearerAuth()
@UseGuards(AuthGuard('jwt'))
@Controller('attempts')
export class AttemptsController {
  constructor(private readonly svc: AttemptsService) {}

  /** UC-01: начать тест */
  @Post()
  start(
    @Body('testId', ParseUUIDPipe) testId: string,
    @CurrentUser() user: JwtPayload,
    @Body('assignmentId') assignmentId?: string,
  ) {
    return this.svc.start(testId, user.sub, assignmentId);
  }

  @Get(':id')
  findOne(@Param('id', ParseUUIDPipe) id: string) {
    return this.svc.findOne(id);
  }

  /** UC-02: отправить ответ */
  @Post(':id/answers')
  submitAnswer(
    @Param('id', ParseUUIDPipe) id: string,
    @Body() dto: SubmitAnswerDto,
    @CurrentUser() user: JwtPayload,
  ) {
    return this.svc.submitAnswer(id, dto, user.sub);
  }

  /** UC-03: завершить тест */
  @Patch(':id/finish')
  finish(
    @Param('id', ParseUUIDPipe) id: string,
    @CurrentUser() user: JwtPayload,
  ) {
    return this.svc.finish(id, user.sub);
  }
}
