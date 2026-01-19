import { Injectable } from '@nestjs/common';
import { ApiKeyRepo } from './api-key.repo';
import { TokenService } from '../../core/auth/services/token.service';
import { UserRepo } from '@docmost/db/repos/user/user.repo';
import { nanoIdGen } from '../../common/helpers';

@Injectable()
export class ApiKeyService {
  constructor(
    private readonly apiKeyRepo: ApiKeyRepo,
    private readonly tokenService: TokenService,
    private readonly userRepo: UserRepo,
  ) {}

  async getApiKeys(userId: string, workspaceId: string, isAdmin: boolean) {
    if (isAdmin) {
      return this.apiKeyRepo.findByWorkspaceId(workspaceId);
    }
    // For non-admins, only return their own keys
    const allKeys = await this.apiKeyRepo.findByWorkspaceId(workspaceId);
    return allKeys.filter((key) => key.creatorId === userId);
  }

  async createApiKey(
    data: { name: string; expiresAt?: Date },
    userId: string,
    workspaceId: string,
  ) {
    const user = await this.userRepo.findById(userId, workspaceId);
    if (!user) {
      throw new Error('User not found');
    }

    // Create API key record first
    const apiKey = await this.apiKeyRepo.create({
      name: data.name,
      creatorId: userId,
      workspaceId,
      expiresAt: data.expiresAt,
    });

    // Generate JWT token using the API key ID
    const token = await this.tokenService.generateApiToken({
      apiKeyId: apiKey.id,
      user,
      workspaceId,
      expiresIn: data.expiresAt ? undefined : '1y',
    });

    // Return both the API key record and the token
    // Note: token is only returned once during creation
    return {
      ...apiKey,
      token, // This token should be saved by the user as it won't be shown again
    };
  }

  async updateApiKey(id: string, data: { name: string }) {
    return this.apiKeyRepo.update(id, data);
  }

  async revokeApiKey(id: string) {
    console.log('[API Key Service] Revoking API key:', id);
    await this.apiKeyRepo.delete(id);
    console.log('[API Key Service] API key revoked successfully');
  }
}
