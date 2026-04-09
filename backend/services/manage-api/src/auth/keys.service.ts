import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import * as fs from 'fs';
import * as path from 'path';
import * as crypto from 'crypto';

/**
 * KeysService — управление RSA-ключами для JWT RS256.
 * Генерация/загрузка происходит СИНХРОННО в конструкторе, чтобы ключи были
 * доступны сразу при инициализации JwtModule (до onModuleInit).
 */
@Injectable()
export class KeysService {
  private readonly logger = new Logger(KeysService.name);

  readonly privateKey: string;
  readonly publicKey: string;

  constructor(config: ConfigService) {
    const keysDir = path.resolve(config.get<string>('JWT_KEYS_DIR', './keys'));
    const privatePath = path.join(keysDir, 'private.pem');
    const publicPath = path.join(keysDir, 'public.pem');

    if (fs.existsSync(privatePath) && fs.existsSync(publicPath)) {
      this.privateKey = fs.readFileSync(privatePath, 'utf8');
      this.publicKey = fs.readFileSync(publicPath, 'utf8');
      this.logger.log(`RSA keys loaded from ${keysDir}`);
    } else {
      this.logger.warn('RSA keys not found — generating new RSA-4096 pair...');
      fs.mkdirSync(keysDir, { recursive: true });

      const { privateKey, publicKey } = crypto.generateKeyPairSync('rsa', {
        modulusLength: 4096,
        publicKeyEncoding: { type: 'spki', format: 'pem' },
        privateKeyEncoding: { type: 'pkcs8', format: 'pem' },
      });

      // 0600 — только владелец может читать приватный ключ
      fs.writeFileSync(privatePath, privateKey, { mode: 0o600 });
      fs.writeFileSync(publicPath, publicKey, { mode: 0o644 });

      this.privateKey = privateKey;
      this.publicKey = publicKey;
      this.logger.log(`RSA-4096 key pair generated and saved to ${keysDir}`);
    }
  }
}
