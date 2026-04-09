import { Module } from '@nestjs/common';
import { PassportModule } from '@nestjs/passport';
import { JwtModule } from '@nestjs/jwt';
import { ConfigService } from '@nestjs/config';
import { JwtStrategy } from './jwt.strategy';

@Module({
  imports: [
    PassportModule.register({ defaultStrategy: 'jwt' }),
    JwtModule.registerAsync({
      inject: [ConfigService],
      useFactory: (cfg: ConfigService) => ({
        // RS256 — проверяем только публичным ключом (токены выпускает Auth-сервис)
        publicKey: cfg.get<string>('JWT_PUBLIC_KEY')!.replace(/\\n/g, '\n'),
        verifyOptions: { algorithms: ['RS256'] },
      }),
    }),
  ],
  providers: [JwtStrategy],
  exports: [PassportModule],
})
export class AuthModule {}
