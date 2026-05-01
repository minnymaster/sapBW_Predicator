import { Controller, Get, Query, UseGuards, ForbiddenException } from '@nestjs/common';
import { AuthGuard } from '@nestjs/passport';
import { ApiOperation, ApiTags } from '@nestjs/swagger';
import { CurrentUser } from './decorators';
import { JwtPayload } from './jwt.strategy';

/**
 * Используется Learning Gateway (Traefik forwardAuth).
 * GET /v1/auth/validate → 200 если JWT валиден, 401 если нет.
 * Опциональный query-параметр required_role позволяет ограничить доступ по роли.
 */
@ApiTags('auth')
@Controller('auth')
export class AuthController {
  @Get('validate')
  @UseGuards(AuthGuard('jwt'))
  @ApiOperation({ summary: 'Проверка JWT для Traefik forwardAuth' })
  validate(
    @CurrentUser() user: JwtPayload,
    @Query('required_role') requiredRole?: string,
  ) {
    if (requiredRole && user.role !== requiredRole) {
      throw new ForbiddenException(`Role '${user.role}' is not allowed`);
    }
    return { sub: user.sub, role: user.role, email: user.email };
  }
}
