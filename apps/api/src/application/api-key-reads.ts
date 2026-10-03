import { parameter, query } from '@cleverbrush/knex-schema';
import { ApiKeyDbSchema, type AppDb, UserDbSchema } from '../db/schemas.js';

/** Fresh credentials and principal data on every authentication attempt. */
export const apiKeyAuthReads = {
    key: query(ApiKeyDbSchema)
        .where(row => row.keyId, parameter('keyId'))
        .limit(1),
    user: query(UserDbSchema)
        .select(row => ({ id: row.id, role: row.role }))
        .where(row => row.id, parameter('userId'))
        .limit(1)
};

export async function findAuthKey(db: AppDb, keyId: string) {
    return (await apiKeyAuthReads.key(db.knex, keyId))[0];
}
export async function findAuthUser(db: AppDb, userId: number) {
    return (await apiKeyAuthReads.user(db.knex, userId))[0];
}
