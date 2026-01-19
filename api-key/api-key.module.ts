import { Module } from '@nestjs/common';
import { ApiKeyService } from './api-key.service';
import { ApiKeyController } from './api-key.controller';
import { ApiKeyRepo } from './api-key.repo';
import { TokenService } from '../../core/auth/services/token.service';
import { UserRepo } from '@docmost/db/repos/user/user.repo';

@Module({
  controllers: [ApiKeyController],
  providers: [ApiKeyService, ApiKeyRepo, TokenService, UserRepo],
  exports: [ApiKeyService],
})
export class ApiKeyModule {}
