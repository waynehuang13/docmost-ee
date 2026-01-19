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
    return allKeys.filter((key) => key.userId === userId);
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

    // Generate API key token
    const apiKeyId = nanoIdGen(32);
    const token = await this.tokenService.generateApiToken({
      apiKeyId,
      user,
      workspaceId,
      expiresIn: data.expiresAt ? undefined : '1y',
    });

    return this.apiKeyRepo.create({
      name: data.name,
      userId,
      workspaceId,
      token,
      expiresAt: data.expiresAt,
    });
  }

  async updateApiKey(id: string, data: { name: string }) {
    return this.apiKeyRepo.update(id, data);
  }

  async revokeApiKey(id: string) {
    await this.apiKeyRepo.delete(id);
  }
}
