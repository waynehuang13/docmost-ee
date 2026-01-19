import {
  Injectable,
  UnauthorizedException,
  BadRequestException,
} from '@nestjs/common';
import { Issuer, Client, generators } from 'openid-client';
import { AuthProvider } from '@docmost/db/types/entity.types';
import { InjectKysely } from 'nestjs-kysely';
import { Kysely } from 'kysely';
import { DB } from '@docmost/db/types/db';

export interface OIDCUserInfo {
  sub: string;
  email: string;
  name?: string;
  given_name?: string;
  family_name?: string;
  picture?: string;
}

@Injectable()
export class OIDCService {
  private clients: Map<string, Client> = new Map();
  private stateCache: Map<
    string,
    { nonce: string; providerId: string; timestamp: number }
  > = new Map();

  constructor(@InjectKysely() private readonly db: Kysely<DB>) {
    // Clean up old states every 10 minutes
    setInterval(
      () => {
        const now = Date.now();
        const tenMinutes = 10 * 60 * 1000;
        for (const [state, data] of this.stateCache.entries()) {
          if (now - data.timestamp > tenMinutes) {
            this.stateCache.delete(state);
          }
        }
      },
      10 * 60 * 1000,
    );
  }

  storeState(state: string, nonce: string, providerId: string): void {
    this.stateCache.set(state, { nonce, providerId, timestamp: Date.now() });
  }

  getStateData(
    state: string,
  ): { nonce: string; providerId: string } | undefined {
    const data = this.stateCache.get(state);
    if (data) {
      this.stateCache.delete(state); // One-time use
      return { nonce: data.nonce, providerId: data.providerId };
    }
    return undefined;
  }

  async getClient(provider: AuthProvider): Promise<Client> {
    if (
      !provider.oidcIssuer ||
      !provider.oidcClientId ||
      !provider.oidcClientSecret
    ) {
      throw new BadRequestException('OIDC provider is not properly configured');
    }

    // Check if we have a cached client
    const cacheKey = provider.id;
    if (this.clients.has(cacheKey)) {
      return this.clients.get(cacheKey)!;
    }

    try {
      // Discover OIDC issuer configuration
      const issuer = await Issuer.discover(provider.oidcIssuer);

      // Create client
      const client = new issuer.Client({
        client_id: provider.oidcClientId,
        client_secret: provider.oidcClientSecret,
        redirect_uris: [this.getRedirectUri(provider)],
        response_types: ['code'],
      });

      // Cache the client
      this.clients.set(cacheKey, client);

      return client;
    } catch (error) {
      const errorMessage =
        error instanceof Error ? error.message : 'Unknown error';
      throw new BadRequestException(
        `Failed to initialize OIDC client: ${errorMessage}`,
      );
    }
  }

  getRedirectUri(provider: AuthProvider): string {
    // In production, this should come from environment config
    const baseUrl = process.env.APP_URL || 'http://localhost:3000';
    return `${baseUrl}/api/sso/oidc/${provider.id}/callback`;
  }

  async getAuthorizationUrl(
    provider: AuthProvider,
  ): Promise<{ url: string; state: string; nonce: string }> {
    const client = await this.getClient(provider);

    const state = generators.state();
    const nonce = generators.nonce();

    const url = client.authorizationUrl({
      scope: 'openid email profile',
      state,
      nonce,
    });

    return { url, state, nonce };
  }

  async handleCallback(
    provider: AuthProvider,
    params: any,
    expectedState: string,
    expectedNonce: string,
  ): Promise<OIDCUserInfo> {
    const client = await this.getClient(provider);

    try {
      const tokenSet = await client.callback(
        this.getRedirectUri(provider),
        params,
        { state: expectedState, nonce: expectedNonce },
      );

      const userinfo = await client.userinfo(tokenSet.access_token!);

      if (!userinfo.email) {
        throw new UnauthorizedException('Email not provided by OIDC provider');
      }

      return {
        sub: userinfo.sub,
        email: userinfo.email as string,
        name: userinfo.name as string,
        given_name: userinfo.given_name as string,
        family_name: userinfo.family_name as string,
        picture: userinfo.picture as string,
      };
    } catch (error) {
      const errorMessage =
        error instanceof Error ? error.message : 'Unknown error';
      throw new UnauthorizedException(
        `OIDC authentication failed: ${errorMessage}`,
      );
    }
  }

  async createOrUpdateAuthAccount(
    userId: string,
    providerId: string,
    providerUserId: string,
    workspaceId: string,
  ): Promise<void> {
    const existing = await this.db
      .selectFrom('authAccounts')
      .selectAll()
      .where('userId', '=', userId)
      .where('authProviderId', '=', providerId)
      .executeTakeFirst();

    if (existing) {
      await this.db
        .updateTable('authAccounts')
        .set({
          providerUserId,
          updatedAt: new Date(),
        })
        .where('id', '=', existing.id)
        .execute();
    } else {
      await this.db
        .insertInto('authAccounts')
        .values({
          userId,
          authProviderId: providerId,
          providerUserId,
          workspaceId,
        })
        .execute();
    }
  }

  async findUserByProviderUserId(
    providerId: string,
    providerUserId: string,
  ): Promise<string | null> {
    const account = await this.db
      .selectFrom('authAccounts')
      .select('userId')
      .where('authProviderId', '=', providerId)
      .where('providerUserId', '=', providerUserId)
      .where('deletedAt', 'is', null)
      .executeTakeFirst();

    return account?.userId || null;
  }
}
