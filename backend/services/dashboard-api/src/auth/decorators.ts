import { createParamDecorator, ExecutionContext, SetMetadata } from '@nestjs/common';
import { Request } from 'express';
import { JwtPayload } from './jwt.strategy';

export const CurrentUser = createParamDecorator(
  (_data: unknown, ctx: ExecutionContext): JwtPayload => {
    const req = ctx.switchToHttp().getRequest<{ user: JwtPayload }>();
    return req.user;
  },
);

export const Roles = (...roles: JwtPayload['role'][]) =>
  SetMetadata('roles', roles);

/** Извлекает сырой JWT-токен из заголовка Authorization для пробрасывания в downstream-сервисы */
export const RawToken = createParamDecorator(
  (_data: unknown, ctx: ExecutionContext): string => {
    const req = ctx.switchToHttp().getRequest<Request>();
    const auth = req.headers['authorization'] ?? '';
    return auth.replace(/^Bearer\s+/i, '');
  },
);
