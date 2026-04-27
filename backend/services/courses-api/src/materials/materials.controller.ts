import {
  Body,
  Controller,
  Delete,
  Get,
  HttpCode,
  HttpStatus,
  Param,
  ParseUUIDPipe,
  Post,
  Put,
  UseGuards,
} from '@nestjs/common';
import { AuthGuard } from '@nestjs/passport';
import {
  ApiBearerAuth,
  ApiNoContentResponse,
  ApiOperation,
  ApiResponse,
  ApiTags,
} from '@nestjs/swagger';
import { CurrentUser, Roles } from '../auth/decorators';
import { RolesGuard } from '../auth/roles.guard';
import { JwtPayload } from '../auth/jwt.strategy';
import { MaterialsService } from './materials.service';
import { CreateMaterialDto } from './dto/create-material.dto';
import { MaterialResponseDto } from './dto/material-response.dto';
import { UpdateMaterialDto } from './dto/update-material.dto';

@ApiTags('materials')
@ApiBearerAuth()
@UseGuards(AuthGuard('jwt'), RolesGuard)
@Controller('v1/materials')
export class MaterialsController {
  constructor(private readonly materialsService: MaterialsService) {}

  /**
   * GET /v1/materials/:id
   * Материал с текущей версией (isCurrent=true). Доступен всем ролям.
   */
  @Get(':id')
  @ApiOperation({ summary: 'Материал с текущей MaterialVersion' })
  @ApiResponse({ status: 200, type: MaterialResponseDto })
  @ApiResponse({ status: 404, description: 'Материал не найден' })
  findOne(@Param('id', ParseUUIDPipe) id: string): Promise<MaterialResponseDto> {
    return this.materialsService.findOne(id);
  }

  /**
   * POST /v1/materials — создать материал + MaterialVersion v1. Только HR.
   * contentHash = sha256(fileKey ?? url).
   */
  @Post()
  @HttpCode(HttpStatus.CREATED)
  @Roles('hr')
  @ApiOperation({ summary: 'Создать материал (создаёт MaterialVersion v1 с SHA-256)' })
  @ApiResponse({ status: 201, type: MaterialResponseDto })
  @ApiResponse({ status: 400, description: 'Не указан fileKey или url' })
  @ApiResponse({ status: 404, description: 'Модуль не найден' })
  create(
    @Body() dto: CreateMaterialDto,
    @CurrentUser() user: JwtPayload,
  ): Promise<MaterialResponseDto> {
    return this.materialsService.create(dto, user.sub);
  }

  /**
   * PUT /v1/materials/:id — обновить материал с версионированием (NFR-18). Только HR.
   *
   * Транзакция:
   *   • Старая MaterialVersion → isCurrent=false
   *   • Новая MaterialVersion → versionNumber+1, isCurrent=true,
   *     contentHash = sha256(fileKey ?? url)
   */
  @Put(':id')
  @Roles('hr')
  @ApiOperation({
    summary: 'Обновить материал (NFR-18: новая MaterialVersion с SHA-256, транзакция)',
  })
  @ApiResponse({ status: 200, type: MaterialResponseDto })
  @ApiResponse({ status: 404, description: 'Материал не найден' })
  update(
    @Param('id', ParseUUIDPipe) id: string,
    @Body() dto: UpdateMaterialDto,
    @CurrentUser() user: JwtPayload,
  ): Promise<MaterialResponseDto> {
    return this.materialsService.update(id, dto, user.sub);
  }

  /**
   * DELETE /v1/materials/:id — мягкое удаление (isActive=false). Только HR.
   * История версий и прогресс сотрудников сохраняются.
   */
  @Delete(':id')
  @HttpCode(HttpStatus.NO_CONTENT)
  @Roles('hr')
  @ApiOperation({ summary: 'Удалить материал (мягко: isActive=false)' })
  @ApiNoContentResponse()
  @ApiResponse({ status: 404, description: 'Материал не найден' })
  async delete(@Param('id', ParseUUIDPipe) id: string): Promise<void> {
    return this.materialsService.delete(id);
  }
}
