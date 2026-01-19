import { Controller, Get, Post, Body, Param, UseGuards } from '@nestjs/common';
import { JwtAuthGuard } from '../../common/guards/jwt-auth.guard';
import { SecurityService } from './security.service';
import { AuthWorkspace } from '../../common/decorators/auth-workspace.decorator';
import { AuthUser } from '../../common/decorators/auth-user.decorator';
import { Workspace, User } from '@docmost/db/types/entity.types';

@Controller('security')
@UseGuards(JwtAuthGuard)
export class SecurityController {
  constructor(private readonly securityService: SecurityService) {}

  @Get('providers')
  async getProviders(@AuthWorkspace() workspace: Workspace) {
    return this.securityService.getProviders(workspace.id);
  }

  @Get('providers/:id')
  async getProvider(@Param('id') id: string) {
    return this.securityService.getProvider(id);
  }

  @Post('providers/oidc')
  async createOIDCProvider(
    @Body() dto: any,
    @AuthWorkspace() workspace: Workspace,
    @AuthUser() user: User,
  ) {
    return this.securityService.createOIDCProvider(dto, workspace.id, user.id);
  }

  @Post('providers/saml')
  async createSAMLProvider(
    @Body() dto: any,
    @AuthWorkspace() workspace: Workspace,
    @AuthUser() user: User,
  ) {
    return this.securityService.createSAMLProvider(dto, workspace.id, user.id);
  }
}
