import { Module } from '@nestjs/common';
import { PassportModule } from '@nestjs/passport';
import { JwtModule } from '@nestjs/jwt';
import { KeysService } from './keys.service';
import { JwtStrategy } from './jwt.strategy';
import { AuthService } from './auth.service';
import { AuthController } from './auth.controller';

/** TTL access-токена (15 минут) */
const JWT_EXPIRES_IN = '15m';

@Module({
  imports: [
    PassportModule.register({ defaultStrategy: 'jwt' }),
    /**
     * KeysService глобален (KeysModule помечен @Global в AppModule),
     * поэтому доступен для inject без повторного imports.
     * Конструктор KeysService синхронно генерирует/загружает RSA-4096 пару.
     * Алгоритм RS256: sign privateKey, verify publicKey (NFR-08).
     */
    JwtModule.registerAsync({
      inject: [KeysService],
      useFactory: (keys: KeysService) => ({
        privateKey: keys.privateKey,
        publicKey: keys.publicKey,
        signOptions: {
          algorithm: 'RS256',
          expiresIn: JWT_EXPIRES_IN,
        },
      }),
    }),
  ],
  providers: [AuthService, JwtStrategy],
  controllers: [AuthController],
  exports: [PassportModule],
})
export class AuthModule {}
