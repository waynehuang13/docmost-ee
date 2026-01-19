import {
  Controller,
  Post,
  Get,
  Body,
  Param,
  Res,
  Query,
  UseGuards,
  HttpCode,
  HttpStatus,
} from '@nestjs/common';
import { FastifyReply } from 'fastify';
import { JwtAuthGuard } from '../../common/guards/jwt-auth.guard';
import { AuthUser } from '../../common/decorators/auth-user.decorator';
import { AuthWorkspace } from '../../common/decorators/auth-workspace.decorator';
import { User, Workspace } from '@docmost/db/types/entity.types';
import { Public } from '../../common/decorators/public.decorator';
import { SecurityService } from './security.service';
import { AuthProviderRepo } from '../auth-provider/auth-provider.repo';
import { OIDCService } from '../oidc/oidc.service';
import { UserRepo } from '@docmost/db/repos/user/user.repo';
import { TokenService } from '../../core/auth/services/token.service';
import { EnvironmentService } from '../../integrations/environment/environment.service';
import { hashPassword, nanoIdGen } from '../../common/helpers';

// This controller provides compatibility with the frontend's expected routes
// Maps /api/sso/* to the SecurityService

@Controller('sso')
@UseGuards(JwtAuthGuard)
export class SsoController {
  constructor(
    private readonly securityService: SecurityService,
    private readonly authProviderRepo: AuthProviderRepo,
    private readonly oidcService: OIDCService,
    private readonly userRepo: UserRepo,
    private readonly tokenService: TokenService,
    private readonly environmentService: EnvironmentService,
  ) {}

  @Post('providers')
  async getProviders(@AuthWorkspace() workspace: Workspace) {
    return this.securityService.getProviders(workspace.id);
  }

  @Post('info')
  async getProviderInfo(@Body() body: { providerId: string }) {
    const provider = await this.securityService.getProvider(body.providerId);
    // Don't expose secrets
    const { oidcClientSecret, ...safeProvider } = provider as any;
    return {
      ...safeProvider,
      oidcClientSecret: oidcClientSecret ? '********' : null,
    };
  }

  @Post('create')
  @HttpCode(HttpStatus.CREATED)
  async createProvider(
    @Body() data: any,
    @AuthWorkspace() workspace: Workspace,
    @AuthUser() user: User,
  ) {
    const { type, ...dto } = data;
    console.log('Creating SSO provider:', {
      type,
      name: dto.name,
      workspaceId: workspace.id,
    });

    switch (type) {
      case 'oidc':
        const oidcProvider = await this.securityService.createOIDCProvider(
          {
            name: dto.name,
            oidcIssuer: dto.oidcIssuer,
            oidcClientId: dto.oidcClientId,
            oidcClientSecret: dto.oidcClientSecret,
            allowSignup: dto.allowSignup,
            isEnabled: dto.isEnabled,
            groupSync: dto.groupSync,
          },
          workspace.id,
          user.id,
        );
        console.log('OIDC Provider created successfully:', {
          id: oidcProvider.id,
          name: oidcProvider.name,
          isEnabled: oidcProvider.isEnabled,
        });
        return oidcProvider;

      case 'saml':
        return this.securityService.createSAMLProvider(
          {
            name: dto.name,
            samlUrl: dto.samlUrl,
            samlCertificate: dto.samlCertificate,
            allowSignup: dto.allowSignup,
            isEnabled: dto.isEnabled,
            groupSync: dto.groupSync,
          },
          workspace.id,
          user.id,
        );

      case 'google':
        // Google is treated as OIDC with preset issuer
        return this.securityService.createOIDCProvider(
          {
            name: dto.name || 'Google SSO',
            oidcIssuer: 'https://accounts.google.com',
            oidcClientId: dto.oidcClientId || dto.googleClientId,
            oidcClientSecret: dto.oidcClientSecret || dto.googleClientSecret,
            allowSignup: dto.allowSignup,
            isEnabled: dto.isEnabled,
            groupSync: dto.groupSync,
          },
          workspace.id,
          user.id,
        );

      case 'ldap':
        // LDAP support would go here
        throw new Error('LDAP support not implemented yet');

      default:
        throw new Error(`Unsupported SSO provider type: ${type}`);
    }
  }

  @Post('update')
  async updateProvider(@Body() data: any) {
    // Frontend sends 'providerId', but also support 'id'
    const id = data.providerId || data.id;
    const { providerId, ...updates } = data;
    delete updates.id; // Remove id from updates object

    console.log('Updating SSO provider:', { id, updates });
    return this.securityService.updateProvider(id, updates);
  }

  @Post('delete')
  @HttpCode(HttpStatus.NO_CONTENT)
  async deleteProvider(@Body() body: { providerId: string }) {
    await this.securityService.deleteProvider(body.providerId);
  }

  @Post('toggle')
  async toggleProvider(
    @Body() body: { providerId: string; isEnabled: boolean },
  ) {
    return this.securityService.toggleProvider(body.providerId, body.isEnabled);
  }

  // OIDC Login Routes (frontend expects /api/sso/oidc/:providerId/login)
  @Public()
  @Get('oidc/:providerId/login')
  async oidcLogin(
    @Param('providerId') providerId: string,
    @Res() res: FastifyReply,
  ) {
    try {
      console.log('OIDC Login attempt for provider ID:', providerId);
      const provider = await this.authProviderRepo.findById(providerId);
      console.log(
        'Found provider:',
        provider ? `${provider.name} (${provider.type})` : 'null',
      );

      if (!provider) {
        console.error('Provider not found with ID:', providerId);
        return res.status(400).send('Auth provider not found');
      }

      if (!provider.isEnabled) {
        console.error('Provider disabled:', providerId);
        return res.status(400).send('Auth provider is disabled');
      }

      if (provider.type !== 'oidc') {
        return res.status(400).send('Invalid provider type');
      }

      console.log('Getting authorization URL for provider:', {
        issuer: provider.oidcIssuer,
        clientId: provider.oidcClientId,
      });

      const { url, state, nonce } =
        await this.oidcService.getAuthorizationUrl(provider);

      console.log('Authorization URL generated successfully');
      console.log('Redirect URL:', url);

      // Store state and nonce in memory cache (not session)
      this.oidcService.storeState(state, nonce, providerId);

      console.log('Sending redirect to:', url);
      return res.status(302).redirect(url);
    } catch (error) {
      console.error('OIDC Login error:', error);
      const errorMessage =
        error instanceof Error ? error.message : 'Unknown error';
      return res.status(500).send(`OIDC Login failed: ${errorMessage}`);
    }
  }

  @Public()
  @Get('oidc/:providerId/callback')
  async oidcCallback(
    @Param('providerId') providerId: string,
    @Query() query: any,
    @Res() res: FastifyReply,
  ) {
    try {
      console.log('OIDC Callback received for provider:', providerId);
      console.log('Query params:', { state: query.state, code: query.code ? 'present' : 'missing' });

      const provider = await this.authProviderRepo.findById(providerId);

      if (!provider) {
        console.error('Provider not found:', providerId);
        return res.status(302).redirect('/?error=provider_not_found');
      }

      // Verify state and get nonce from cache
      const stateData = this.oidcService.getStateData(query.state);

      if (!stateData || stateData.providerId !== providerId) {
        console.error('Invalid state or provider mismatch');
        return res.status(302).redirect('/?error=invalid_state');
      }

      const expectedNonce = stateData.nonce;
      console.log('State verified successfully');

      // Get user info from OIDC provider
      const userInfo = await this.oidcService.handleCallback(
        provider,
        query,
        query.state,
        expectedNonce,
      );
      console.log('User info received from OIDC:', { email: userInfo.email, sub: userInfo.sub });

      // Find or create user
      let user = await this.userRepo.findByEmail(userInfo.email, provider.workspaceId);

      if (!user) {
        console.log('User not found, checking if signup is allowed');
        if (!provider.allowSignup) {
          console.error('Signup not allowed for this provider');
          return res.status(302).redirect('/?error=signup_not_allowed');
        }

        console.log('Creating new user from OIDC');
        // Create new user
        const randomPassword = await hashPassword(nanoIdGen(32));
        user = await this.userRepo.insertUser({
          email: userInfo.email,
          name: userInfo.name || userInfo.email.split('@')[0],
          password: randomPassword,
          workspaceId: provider.workspaceId,
          role: 'member',
          hasGeneratedPassword: true,
        });
        console.log('New user created:', { id: user.id, email: user.email });
      } else {
        console.log('Existing user found:', { id: user.id, email: user.email });
      }

      // Link OIDC account to user
      await this.oidcService.createOrUpdateAuthAccount(
        user.id,
        provider.id,
        userInfo.sub,
        provider.workspaceId,
      );
      console.log('Auth account linked successfully');

      // Update last login
      await this.userRepo.updateLastLogin(user.id, provider.workspaceId);

      // Generate JWT token
      const authToken = await this.tokenService.generateAccessToken(user);
      console.log('JWT token generated successfully');

      // Set auth cookie
      this.setAuthCookie(res, authToken);
      console.log('Auth cookie set, redirecting to home page');

      // Redirect to home page
      return res.status(302).redirect('/');
    } catch (error) {
      console.error('OIDC Callback error:', error);
      const errorMessage =
        error instanceof Error ? error.message : 'Unknown error';
      return res.status(302).redirect(`/?error=${encodeURIComponent(errorMessage)}`);
    }
  }

  private setAuthCookie(res: FastifyReply, token: string) {
    res.setCookie('authToken', token, {
      httpOnly: true,
      path: '/',
      expires: this.environmentService.getCookieExpiresIn(),
      secure: this.environmentService.isHttps(),
    });
  }
}
