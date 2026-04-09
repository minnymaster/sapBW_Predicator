import { Injectable, UnauthorizedException } from '@nestjs/common';
import { PassportStrategy } from '@nestjs/passport';
import { ExtractJwt, Strategy } from 'passport-jwt';
import { ConfigService } from '@nestjs/config';

export interface JwtPayload {
  sub: string;       // employeeId (UUID) из company_db
  role: 'employee' | 'hr' | 'director';
  email: string;
  iat: number;
  exp: number;
}

@Injectable()
export class JwtStrategy extends PassportStrategy(Strategy) {
  constructor(cfg: ConfigService) {
    super({
      jwtFromRequest: ExtractJwt.fromAuthHeaderAsBearerToken(),
      ignoreExpiration: false,
      secretOrKey: cfg.get<string>('JWT_PUBLIC_KEY')!.replace(/\\n/g, '\n'),
      algorithms: ['RS256'],
    });
  }

  validate(payload: JwtPayload): JwtPayload {
    if (!payload.sub || !payload.role) {
      throw new UnauthorizedException('Invalid token payload');
    }
    return payload;
  }
}
