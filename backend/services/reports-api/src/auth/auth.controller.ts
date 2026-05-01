import { Controller, ForbiddenException, Get, Query, UseGuards } from '@nestjs/common';
import { AuthGuard } from '@nestjs/passport';
import { ApiOperation, ApiTags } from '@nestjs/swagger';
import { CurrentUser } from './decorators';
import { JwtPayload } from './jwt.strategy';

/**
 * Используется Analytics Gateway (Traefik forwardAuth).
 * GET /v1/auth/validate — исключён из глобального префикса v1/reports (см. main.ts).
 * Поддерживает ?required_roles=director,hr для RBAC.
 */
@ApiTags('auth')
@Controller('v1/auth')
export class AuthController {
  @Get('validate')
  @UseGuards(AuthGuard('jwt'))
  @ApiOperation({ summary: 'Проверка JWT для Traefik forwardAuth' })
  validate(
    @CurrentUser() user: JwtPayload,
    @Query('required_roles') requiredRoles?: string,
  ) {
    if (requiredRoles) {
      const allowed = requiredRoles.split(',').map((r) => r.trim());
      if (!allowed.includes(user.role)) {
        throw new ForbiddenException(`Role '${user.role}' is not allowed`);
      }
    }
    return { sub: user.sub, role: user.role, email: user.email };
  }
}
