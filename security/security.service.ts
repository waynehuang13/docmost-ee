import { Injectable } from '@nestjs/common';
import { AuthProviderRepo } from '../auth-provider/auth-provider.repo';
import { AuthProvider } from '@docmost/db/types/entity.types';

export interface CreateOIDCProviderDto {
  name: string;
  oidcIssuer: string;
  oidcClientId: string;
  oidcClientSecret: string;
  allowSignup?: boolean;
  isEnabled?: boolean;
  groupSync?: boolean;
}

export interface CreateSAMLProviderDto {
  name: string;
  samlUrl: string;
  samlCertificate: string;
  allowSignup?: boolean;
  isEnabled?: boolean;
  groupSync?: boolean;
}

@Injectable()
export class SecurityService {
  constructor(private readonly authProviderRepo: AuthProviderRepo) {}

  async getProviders(workspaceId: string): Promise<AuthProvider[]> {
    return this.authProviderRepo.findByWorkspaceId(workspaceId);
  }

  async getProvider(id: string): Promise<AuthProvider> {
    const provider = await this.authProviderRepo.findById(id);
    if (!provider) {
      throw new Error('Provider not found');
    }
    return provider;
  }

  async createOIDCProvider(
    dto: CreateOIDCProviderDto,
    workspaceId: string,
    creatorId: string,
  ): Promise<AuthProvider> {
    return this.authProviderRepo.create({
      name: dto.name,
      type: 'oidc',
      workspaceId,
      creatorId,
      oidcIssuer: dto.oidcIssuer,
      oidcClientId: dto.oidcClientId,
      oidcClientSecret: dto.oidcClientSecret,
      allowSignup: dto.allowSignup ?? false,
      isEnabled: dto.isEnabled ?? false,
      groupSync: dto.groupSync ?? false,
    });
  }

  async createSAMLProvider(
    dto: CreateSAMLProviderDto,
    workspaceId: string,
    creatorId: string,
  ): Promise<AuthProvider> {
    return this.authProviderRepo.create({
      name: dto.name,
      type: 'saml',
      workspaceId,
      creatorId,
      samlUrl: dto.samlUrl,
      samlCertificate: dto.samlCertificate,
      allowSignup: dto.allowSignup ?? false,
      isEnabled: dto.isEnabled ?? false,
      groupSync: dto.groupSync ?? false,
    });
  }

  async updateProvider(id: string, updates: Partial<AuthProvider>): Promise<AuthProvider> {
    return this.authProviderRepo.update(id, updates);
  }

  async deleteProvider(id: string): Promise<void> {
    await this.authProviderRepo.delete(id);
  }

  async toggleProvider(id: string, isEnabled: boolean): Promise<AuthProvider> {
    return this.authProviderRepo.update(id, { isEnabled });
  }
}
