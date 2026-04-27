import { Global, Module } from '@nestjs/common';
import { KeysService } from './keys.service';

@Global()
@Module({
  providers: [KeysService],
  exports: [KeysService],
})
export class KeysModule {}
