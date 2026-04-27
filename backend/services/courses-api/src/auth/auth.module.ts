import { Module } from '@nestjs/common';
import { JwtModule } from '@nestjs/jwt';
import { PassportModule } from '@nestjs/passport';
import { KeysService } from './keys.service';
import { JwtStrategy } from './jwt.strategy';

// Courses API не выдаёт JWT — только верифицирует токены от manage-api.
// JwtModule инициализируется с publicKey для верификации RS256.
@Module({
  imports: [
    PassportModule.register({ defaultStrategy: 'jwt' }),
    JwtModule.registerAsync({
      inject: [KeysService],
      useFactory: (keys: KeysService) => ({
        publicKey: keys.publicKey,
        verifyOptions: { algorithms: ['RS256'] },
      }),
    }),
  ],
  providers: [JwtStrategy],
  exports: [PassportModule],
})
export class AuthModule {}
