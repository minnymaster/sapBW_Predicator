import {
  Body, Controller, Get, Param, ParseUUIDPipe, Patch, Post, UseGuards,
} from '@nestjs/common';
import { AuthGuard } from '@nestjs/passport';
import { ApiBearerAuth, ApiTags } from '@nestjs/swagger';
import { RecommendationsService } from './recommendations.service';
import { CurrentUser } from '../auth/decorators';
import { JwtPayload } from '../auth/jwt.strategy';
import { RecommendationStatus } from '../../generated/prisma';

@ApiTags('recommendations')
@ApiBearerAuth()
@UseGuards(AuthGuard('jwt'))
@Controller('recommendations')
export class RecommendationsController {
  constructor(private readonly svc: RecommendationsService) {}

  /** UC-04: сгенерировать рекомендации по результатам попытки */
  @Post('attempts/:attemptId')
  generate(
    @Param('attemptId', ParseUUIDPipe) attemptId: string,
    @CurrentUser() user: JwtPayload,
  ) {
    return this.svc.generateForAttempt(attemptId, user.sub);
  }

  @Get('me')
  findMine(@CurrentUser() user: JwtPayload) {
    return this.svc.findByEmployee(user.sub);
  }

  @Patch(':id/status')
  updateStatus(
    @Param('id', ParseUUIDPipe) id: string,
    @Body('status') status: RecommendationStatus,
  ) {
    return this.svc.updateStatus(id, status);
  }
}
