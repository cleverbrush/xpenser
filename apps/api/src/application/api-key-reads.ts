import { parameter, query } from '@cleverbrush/knex-schema';
import { ApiKeyDbSchema, type AppDb, UserDbSchema } from '../db/schemas.js';
import { perConnection } from './read-models.js';

/** Fresh credentials and principal data on every authentication attempt. */
export const apiKeyAuthReads = perConnection(knex => ({
    key: query(knex, ApiKeyDbSchema)
        .where(row => row.keyId, parameter('keyId'))
        .limit(1),
    user: query(knex, UserDbSchema)
        .select(row => ({ id: row.id, role: row.role }))
        .where(row => row.id, parameter('userId'))
        .limit(1)
}));

export async function findAuthKey(db: AppDb, keyId: string) {
    return (await apiKeyAuthReads(db.knex).key(keyId))[0];
}
export async function findAuthUser(db: AppDb, userId: number) {
    return (await apiKeyAuthReads(db.knex).user(userId))[0];
}
