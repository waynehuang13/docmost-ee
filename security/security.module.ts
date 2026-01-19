import { Module } from '@nestjs/common';
import { SecurityService } from './security.service';
import { SecurityController } from './security.controller';
import { SsoController } from './sso.controller';
import { AuthProviderModule } from '../auth-provider/auth-provider.module';
import { OIDCModule } from '../oidc/oidc.module';
import { UserRepo } from '@docmost/db/repos/user/user.repo';
import { TokenModule } from '../../core/auth/token.module';
import { EnvironmentService } from '../../integrations/environment/environment.service';

@Module({
  imports: [AuthProviderModule, OIDCModule, TokenModule],
  controllers: [SecurityController, SsoController],
  providers: [SecurityService, UserRepo, EnvironmentService],
  exports: [SecurityService],
})
export class SecurityModule {}
