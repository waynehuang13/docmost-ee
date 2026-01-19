import {
  Controller,
  Get,
  Post,
  Put,
  Delete,
  Body,
  Param,
  UseGuards,
} from '@nestjs/common';
import { JwtAuthGuard } from '../../common/guards/jwt-auth.guard';
import { ApiKeyService } from './api-key.service';
import { AuthUser } from '../../common/decorators/auth-user.decorator';
import { AuthWorkspace } from '../../common/decorators/auth-workspace.decorator';
import { User, Workspace } from '@docmost/db/types/entity.types';

@Controller('api-keys')
@UseGuards(JwtAuthGuard)
export class ApiKeyController {
  constructor(private readonly apiKeyService: ApiKeyService) {}

  @Post()
  async getApiKeys(
    @AuthUser() user: User,
    @AuthWorkspace() workspace: Workspace,
    @Body() params: { page?: number; limit?: number },
  ) {
    const isAdmin = user.role === 'admin' || user.role === 'owner';
    const apiKeys = await this.apiKeyService.getApiKeys(
      user.id,
      workspace.id,
      isAdmin,
    );

    return {
      items: apiKeys,
      meta: {
        currentPage: params.page || 1,
        perPage: params.limit || 50,
        total: apiKeys.length,
        totalPages: Math.ceil(apiKeys.length / (params.limit || 50)),
      },
    };
  }

  @Get(':id')
  async getApiKey(@Param('id') id: string) {
    // Implementation for getting single API key
    return { id };
  }

  @Post('create')
  async createApiKey(
    @Body() data: { name: string; expiresAt?: Date },
    @AuthUser() user: User,
    @AuthWorkspace() workspace: Workspace,
  ) {
    return this.apiKeyService.createApiKey(data, user.id, workspace.id);
  }

  @Post('update')
  async updateApiKey(@Body() data: { id: string; name: string }) {
    return this.apiKeyService.updateApiKey(data.id, { name: data.name });
  }

  @Put(':id')
  async updateApiKeyById(
    @Param('id') id: string,
    @Body() data: { name: string },
  ) {
    return this.apiKeyService.updateApiKey(id, data);
  }

  @Post('revoke')
  async revokeApiKey(
    @Body() data: { id: string },
    @AuthUser() user: User,
    @AuthWorkspace() workspace: Workspace,
  ) {
    await this.apiKeyService.revokeApiKey(data.id);

    // Return updated list of API keys after revocation
    const isAdmin = user.role === 'admin' || user.role === 'owner';
    const apiKeys = await this.apiKeyService.getApiKeys(
      user.id,
      workspace.id,
      isAdmin,
    );

    return {
      success: true,
      items: apiKeys,
    };
  }

  @Delete(':id')
  async deleteApiKey(
    @Param('id') id: string,
    @AuthUser() user: User,
    @AuthWorkspace() workspace: Workspace,
  ) {
    await this.apiKeyService.revokeApiKey(id);

    // Return updated list of API keys after deletion
    const isAdmin = user.role === 'admin' || user.role === 'owner';
    const apiKeys = await this.apiKeyService.getApiKeys(
      user.id,
      workspace.id,
      isAdmin,
    );

    return {
      success: true,
      items: apiKeys,
    };
  }
}
