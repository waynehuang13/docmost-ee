import { Injectable } from '@nestjs/common';
import { InjectKysely } from 'nestjs-kysely';
import { Kysely } from 'kysely';
import { DB } from '@docmost/db/types/db';
import { AuthProvider } from '@docmost/db/types/entity.types';

@Injectable()
export class AuthProviderRepo {
  constructor(@InjectKysely() private readonly db: Kysely<DB>) {}

  async findById(id: string): Promise<AuthProvider | undefined> {
    return await this.db
      .selectFrom('authProviders')
      .selectAll()
      .where('id', '=', id)
      .where('deletedAt', 'is', null)
      .executeTakeFirst();
  }

  async findByWorkspaceId(workspaceId: string): Promise<AuthProvider[]> {
    return await this.db
      .selectFrom('authProviders')
      .selectAll()
      .where('workspaceId', '=', workspaceId)
      .where('deletedAt', 'is', null)
      .execute();
  }

  async create(data: {
    name: string;
    type: string;
    workspaceId: string;
    creatorId: string;
    oidcIssuer?: string;
    oidcClientId?: string;
    oidcClientSecret?: string;
    samlUrl?: string;
    samlCertificate?: string;
    allowSignup?: boolean;
    isEnabled?: boolean;
    groupSync?: boolean;
  }): Promise<AuthProvider> {
    const result = await this.db
      .insertInto('authProviders')
      .values({
        name: data.name,
        type: data.type,
        workspaceId: data.workspaceId,
        creatorId: data.creatorId,
        oidcIssuer: data.oidcIssuer,
        oidcClientId: data.oidcClientId,
        oidcClientSecret: data.oidcClientSecret,
        samlUrl: data.samlUrl,
        samlCertificate: data.samlCertificate,
        allowSignup: data.allowSignup ?? false,
        isEnabled: data.isEnabled ?? false,
        groupSync: data.groupSync ?? false,
      })
      .returningAll()
      .executeTakeFirstOrThrow();

    return result;
  }

  async update(
    id: string,
    data: Partial<{
      name: string;
      oidcIssuer: string;
      oidcClientId: string;
      oidcClientSecret: string;
      samlUrl: string;
      samlCertificate: string;
      allowSignup: boolean;
      isEnabled: boolean;
      groupSync: boolean;
    }>,
  ): Promise<AuthProvider> {
    const result = await this.db
      .updateTable('authProviders')
      .set({
        ...data,
        updatedAt: new Date(),
      })
      .where('id', '=', id)
      .returningAll()
      .executeTakeFirstOrThrow();

    return result;
  }

  async delete(id: string): Promise<void> {
    await this.db
      .updateTable('authProviders')
      .set({ deletedAt: new Date() })
      .where('id', '=', id)
      .execute();
  }
}
