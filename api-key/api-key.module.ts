import { Module } from '@nestjs/common';
import { ApiKeyService } from './api-key.service';
import { ApiKeyController } from './api-key.controller';
import { ApiKeyRepo } from './api-key.repo';
import { TokenModule } from '../../core/auth/token.module';
import { UserRepo } from '@docmost/db/repos/user/user.repo';

@Module({
  imports: [TokenModule],
  controllers: [ApiKeyController],
  providers: [ApiKeyService, ApiKeyRepo, UserRepo],
  exports: [ApiKeyService],
})
export class ApiKeyModule {}
