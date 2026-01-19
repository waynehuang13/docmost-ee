import { Module } from '@nestjs/common';
import { AuthProviderRepo } from './auth-provider.repo';

@Module({
  providers: [AuthProviderRepo],
  exports: [AuthProviderRepo],
})
export class AuthProviderModule {}
