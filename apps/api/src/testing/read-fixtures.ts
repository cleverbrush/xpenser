import type { AppDb } from '../db/schemas.js';

/** In-memory service fixtures; compiled SQL itself is tested against PostgreSQL. */
export async function readBudgetAccessFixture(
    db: AppDb,
    budgetId: number,
    userId: number
) {
    const [budget, member] = await Promise.all([
        db.budgets.find(budgetId),
        db.budgetMembers
            .where(row => row.budgetId, budgetId)
            .where(row => row.userId, userId)
            .first()
    ]);
    return { budget, member };
}

export async function findAuthKey(db: AppDb, keyId: string) {
    return db.apiKeys.where(row => row.keyId, keyId).first();
}
export async function findAuthUser(db: AppDb, userId: number) {
    return db.users.find(userId);
}
