import {
  Body, Controller, Delete, Get, Param, ParseIntPipe,
  ParseUUIDPipe, Patch, Post, UseGuards,
} from '@nestjs/common';
import { AuthGuard } from '@nestjs/passport';
import { ApiBearerAuth, ApiTags } from '@nestjs/swagger';
import { TestsService } from './tests.service';
import { CreateTestDto } from './dto/create-test.dto';
import { CurrentUser, Roles } from '../auth/decorators';
import { RolesGuard } from '../auth/roles.guard';
import { JwtPayload } from '../auth/jwt.strategy';

@ApiTags('tests')
@ApiBearerAuth()
@UseGuards(AuthGuard('jwt'), RolesGuard)
@Controller('tests')
export class TestsController {
  constructor(private readonly svc: TestsService) {}

  @Get()
  findAll() {
    return this.svc.findAll();
  }

  @Get(':id')
  findOne(@Param('id', ParseUUIDPipe) id: string) {
    return this.svc.findOne(id);
  }

  @Post()
  @Roles('hr')
  create(@Body() dto: CreateTestDto, @CurrentUser() user: JwtPayload) {
    return this.svc.create(dto, user.sub);
  }

  @Post(':id/questions')
  @Roles('hr')
  addQuestion(
    @Param('id', ParseUUIDPipe) testId: string,
    @Body('questionId', ParseUUIDPipe) questionId: string,
    @Body('orderNumber', ParseIntPipe) orderNumber: number,
  ) {
    return this.svc.addQuestion(testId, questionId, orderNumber);
  }

  @Delete(':id/questions/:questionId')
  @Roles('hr')
  removeQuestion(
    @Param('id', ParseUUIDPipe) testId: string,
    @Param('questionId', ParseUUIDPipe) questionId: string,
  ) {
    return this.svc.removeQuestion(testId, questionId);
  }

  @Patch(':id/activate')
  @Roles('hr')
  activate(@Param('id', ParseUUIDPipe) id: string) {
    return this.svc.activate(id);
  }
}
