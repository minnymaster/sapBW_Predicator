import {
  Body,
  Controller,
  ForbiddenException,
  Get,
  HttpCode,
  HttpStatus,
  Post,
  Query,
  UseGuards,
} from '@nestjs/common';
import { AuthGuard } from '@nestjs/passport';
import {
  ApiOperation,
  ApiResponse,
  ApiTags,
} from '@nestjs/swagger';
import { AuthService } from './auth.service';
import { LoginDto } from './dto/login.dto';
import { LoginResponseDto } from './dto/login-response.dto';
import { CurrentUser } from './decorators';
import { JwtPayload } from './jwt.strategy';

@ApiTags('auth')
@Controller('v1/auth')
export class AuthController {
  constructor(private readonly authService: AuthService) {}

  /**
   * POST /v1/auth/login
   * Аутентификация по email + пароль (bcrypt).
   * Возвращает JWT RS256, TTL 15 минут.
   * Payload: { sub: employeeId, role, email }
   */
  @Post('login')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Аутентификация (логин/пароль → JWT RS256)' })
  @ApiResponse({ status: 200, type: LoginResponseDto })
  @ApiResponse({ status: 401, description: 'Invalid credentials' })
  login(@Body() dto: LoginDto): Promise<LoginResponseDto> {
    return this.authService.login(dto);
  }

  /**
   * GET /v1/auth/validate
   * Используется Manage Gateway (Traefik forwardAuth).
   * Опциональный query-параметр required_role ограничивает доступ по роли
   * (например, ?required_role=hr).
   */
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