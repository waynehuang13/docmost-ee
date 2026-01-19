import { Injectable } from '@nestjs/common';
import { InjectKysely } from 'nestjs-kysely';
import { Kysely } from 'kysely';
import { DB } from '@docmost/db/types/db';

@Injectable()
export class ApiKeyRepo {
  constructor(@InjectKysely() private readonly db: Kysely<DB>) {}

  async findById(id: string) {
    return await this.db
      .selectFrom('apiKeys')
      .selectAll()
      .where('id', '=', id)
      .where('deletedAt', 'is', null)
      .executeTakeFirst();
  }

  async findByWorkspaceId(workspaceId: string) {
    return await this.db
      .selectFrom('apiKeys')
      .selectAll()
      .where('workspaceId', '=', workspaceId)
      .where('deletedAt', 'is', null)
      .orderBy('createdAt', 'desc')
      .execute();
  }

  async findByNameAndWorkspace(name: string, workspaceId: string) {
    return await this.db
      .selectFrom('apiKeys')
      .selectAll()
      .where('name', '=', name)
      .where('workspaceId', '=', workspaceId)
      .where('deletedAt', 'is', null)
      .executeTakeFirst();
  }

  async create(data: {
    name: string;
    creatorId: string;
    workspaceId: string;
    expiresAt?: Date;
  }) {
    return await this.db
      .insertInto('apiKeys')
      .values(data)
      .returningAll()
      .executeTakeFirstOrThrow();
  }

  async update(id: string, data: { name?: string }) {
    return await this.db
      .updateTable('apiKeys')
      .set({ ...data, updatedAt: new Date() })
      .where('id', '=', id)
      .returningAll()
      .executeTakeFirstOrThrow();
  }

  async delete(id: string) {
    await this.db
      .updateTable('apiKeys')
      .set({ deletedAt: new Date() })
      .where('id', '=', id)
      .execute();
  }
}
