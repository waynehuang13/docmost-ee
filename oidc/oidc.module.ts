import { Module } from '@nestjs/common';
import { OIDCService } from './oidc.service';
import { OIDCController } from './oidc.controller';

@Module({
  controllers: [OIDCController],
  providers: [OIDCService],
  exports: [OIDCService],
})
export class OIDCModule {}
