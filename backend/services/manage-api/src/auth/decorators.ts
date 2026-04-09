import { createParamDecorator, ExecutionContext, SetMetadata } from '@nestjs/common';
import { JwtPayload } from './jwt.strategy';

/** Извлекает payload текущего пользователя из request */
export const CurrentUser = createParamDecorator(
  (_data: unknown, ctx: ExecutionContext): JwtPayload => {
    const request = ctx.switchToHttp().getRequest();
    return request.user as JwtPayload;
  },
);

/** Ограничение по ролям (RBAC, NFR-08) */
export const Roles = (...roles: JwtPayload['role'][]) =>
  SetMetadata('roles', roles);