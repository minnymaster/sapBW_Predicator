import {
  Injectable,
  UnauthorizedException,
  Logger,
} from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import * as bcrypt from 'bcrypt';
import { PrismaService } from '../prisma/prisma.service';
import { LoginDto } from './dto/login.dto';
import { LoginResponseDto } from './dto/login-response.dto';

/** TTL access-токена в секундах (15 минут, NFR-08) */
const JWT_TTL_SECONDS = 900;

@Injectable()
export class AuthService {
  private readonly logger = new Logger(AuthService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly jwtService: JwtService,
  ) {}

  async login(dto: LoginDto): Promise<LoginResponseDto> {
    const employee = await this.prisma.employee.findUnique({
      where: { email: dto.email },
      select: {
        employeeId: true,
        email: true,
        role: true,
        passwordHash: true,
        isActive: true,
      },
    });

    if (!employee || !employee.isActive) {
      // Одинаковое сообщение — не раскрываем, существует ли аккаунт
      throw new UnauthorizedException('Invalid credentials');
    }

    const passwordValid = await bcrypt.compare(
      dto.password,
      employee.passwordHash,
    );
    if (!passwordValid) {
      throw new UnauthorizedException('Invalid credentials');
    }

    // Payload JWT (sub = employeeId, role для RBAC, email для логов)
    const payload = {
      sub: employee.employeeId,
      role: employee.role,
      email: employee.email,
    };

    const accessToken = this.jwtService.sign(payload);

    this.logger.log(
      `Login successful: employeeId=${employee.employeeId} role=${employee.role}`,
    );

    return {
      accessToken,
      tokenType: 'bearer',
      expiresIn: JWT_TTL_SECONDS,
    };
  }
}