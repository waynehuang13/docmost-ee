import { Module } from '@nestjs/common';
import { AuthProviderModule } from './auth-provider/auth-provider.module';
import { OIDCModule } from './oidc/oidc.module';
import { SecurityModule } from './security/security.module';
import { ApiKeyModule } from './api-key/api-key.module';

@Module({
  imports: [AuthProviderModule, OIDCModule, SecurityModule, ApiKeyModule],
  exports: [AuthProviderModule, OIDCModule, SecurityModule, ApiKeyModule],
})
export class EeModule {}
