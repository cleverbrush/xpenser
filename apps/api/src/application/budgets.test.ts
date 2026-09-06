import { afterEach, describe, expect, it, vi } from 'vitest';
import type { Config } from '../config.js';
import type {
    AppDb,
    BudgetDb,
    BudgetInvitationDb,
    BudgetMemberDb,
    UserDb
} from '../db/schemas.js';
import {
    acceptBudgetInvitation,
    adminBudgetPermissions,
    BudgetAccessError,
    BudgetInvitationInvalidError,
    BudgetMemberError,
    createBudget,
    defaultMemberBudgetPermissions,
    deleteBudget,
    hashBudgetInvitationToken,
    inviteBudgetMember,
    listBudgetAccess,
    listBudgets,
    removeBudgetMember,
    resolveBudgetAccess,
    updateBudget,
    updateBudgetMember
} from './budgets.js';

const sendEmailMock = vi.hoisted(() => vi.fn());

vi.mock('./email.js', () => ({
    sendEmail: sendEmailMock
}));

const timestamp = new Date('2026-06-01T00:00:00.000Z');
const config = {
    app: {
        url: 'https://app.example.com'
    }
} as Config;

class TestQuery<T extends object> implements PromiseLike<T[]> {
    constructor(
        private readonly source: T[],
        private readonly rows: T[] = source,
        private readonly onDelete?: (rows: readonly T[]) => void
    ) {}

    where<TValue>(selector: (row: T) => TValue, value: TValue): TestQuery<T> {
        return new TestQuery(
            this.source,
            this.rows.filter(row => selector(row) === value),
            this.onDelete
        );
    }

    first(): Promise<T | undefined> {
        return Promise.resolve(this.rows[0]);
    }

    whereIn<TValue>(
        selector: (row: T) => TValue,
        values: readonly TValue[]
    ): TestQuery<T> {
        return new TestQuery(
            this.source,
            this.rows.filter(row => values.includes(selector(row))),
            this.onDelete
        );
    }

    update(update: Partial<T>): Promise<T[]> {
        for (const row of this.rows) {
            Object.assign(row, update);
        }
        return Promise.resolve(this.rows);
    }

    delete(): Promise<number> {
        let deleted = 0;
        for (const row of this.rows) {
            const index = this.source.indexOf(row);
            if (index >= 0) {
                this.source.splice(index, 1);
                deleted += 1;
            }
        }
        this.onDelete?.(this.rows);
        return Promise.resolve(deleted);
    }

    // biome-ignore lint/suspicious/noThenProperty: this fake emulates the DB collection promise API.
    then<TResult1 = T[], TResult2 = never>(
        onfulfilled?: ((value: T[]) => TResult1 | PromiseLike<TResult1>) | null,
        onrejected?:
            | ((reason: unknown) => TResult2 | PromiseLike<TResult2>)
            | null
    ): PromiseLike<TResult1 | TResult2> {
        return Promise.resolve(this.rows).then(onfulfilled, onrejected);
    }
}

type TestData = {
    readonly users: UserDb[];
    readonly budgets: BudgetDb[];
    readonly members: BudgetMemberDb[];
    readonly invitations: BudgetInvitationDb[];
    readonly budgetFavoriteCurrencies: Array<{
        readonly budgetId: number;
        readonly currency: string;
    }>;
    nextBudgetId: number;
    nextInvitationId: number;
};

const queryData = new WeakMap<object, TestData>();
function dataForQuery(source: object): TestData {
    const data = queryData.get(source);
    if (!data) throw new Error('Query fixture was not registered.');
    return data;
}

// Query construction is covered against the real ORM in budget-memberships-query.test.ts.
vi.mock('./budget-queries.js', () => ({
    budgetMembershipsQuery: (
        knex: object,
        userId: number,
        status: string,
        mainBudgetId: number
    ) => {
        const query = new BudgetListQuery(dataForQuery(knex))
            .where('member.user_id', userId)
            .orderByRaw('', [mainBudgetId]);
        if (status === 'active') query.whereNull('budget.archived_at');
        if (status === 'archived') query.whereNotNull('budget.archived_at');
        return query.select();
    },
    budgetMembersQuery: (knex: object, budgetId: number) =>
        new BudgetListQuery(dataForQuery(knex))
            .join('users as user')
            .where('member.budget_id', budgetId)
            .select(),
    uniqueActiveBudgetNameQuery: (
        db: object,
        userId: number,
        name: string,
        excludingBudgetId?: number
    ) => {
        const query = new BudgetListQuery(dataForQuery(db))
            .where('member.user_id', userId)
            .whereNull('budget.archived_at')
            .whereRaw('', [name]);
        if (excludingBudgetId !== undefined)
            query.whereNot('member.budget_id', excludingBudgetId);
        return query;
    },
    budgetAdminCountQuery: (db: object, budgetId: number) => ({
        first: async () => ({
            count: String(
                dataForQuery(db).members.filter(
                    row => row.budgetId === budgetId && row.role === 'admin'
                ).length
            )
        })
    })
}));

class BudgetListQuery {
    private userId?: number;
    private budgetId?: number;
    private archived: 'active' | 'archived' | 'all' = 'all';
    private mainBudgetId = 0;
    private displayName?: string;
    private excludingBudgetId?: number;
    private joinedUsers = false;

    constructor(private readonly data: TestData) {}

    join(table?: string): BudgetListQuery {
        if (table === 'users as user') {
            this.joinedUsers = true;
        }
        return this;
    }

    where(column: string, value: unknown): BudgetListQuery {
        if (column === 'member.user_id') {
            this.userId = Number(value);
        }
        if (column === 'member.budget_id') {
            this.budgetId = Number(value);
        }
        return this;
    }

    whereNull(column: string): BudgetListQuery {
        if (column === 'budget.archived_at') {
            this.archived = 'active';
        }
        return this;
    }

    whereNotNull(column: string): BudgetListQuery {
        if (column === 'budget.archived_at') {
            this.archived = 'archived';
        }
        return this;
    }

    orderByRaw(_sql: string, values: readonly unknown[]): BudgetListQuery {
        this.mainBudgetId = Number(values[0] ?? 0);
        return this;
    }

    orderBy(): BudgetListQuery {
        return this;
    }

    whereRaw(_sql: string, values: readonly unknown[]): BudgetListQuery {
        this.displayName = String(values[0] ?? '').toLowerCase();
        return this;
    }

    whereNot(column: string, value: unknown): BudgetListQuery {
        if (column === 'member.budget_id') {
            this.excludingBudgetId = Number(value);
        }
        return this;
    }

    private rows() {
        return this.data.members
            .filter(member => {
                if (
                    this.userId !== undefined &&
                    member.userId !== this.userId
                ) {
                    return false;
                }
                if (
                    this.budgetId !== undefined &&
                    member.budgetId !== this.budgetId
                ) {
                    return false;
                }
                return true;
            })
            .flatMap(member => {
                const budget = this.data.budgets.find(
                    item => item.id === member.budgetId
                );
                if (!budget) {
                    return [];
                }
                if (this.archived === 'active' && budget.archivedAt) {
                    return [];
                }
                if (this.archived === 'archived' && !budget.archivedAt) {
                    return [];
                }
                if (
                    this.excludingBudgetId !== undefined &&
                    member.budgetId === this.excludingBudgetId
                ) {
                    return [];
                }
                if (
                    this.displayName !== undefined &&
                    member.displayName.toLowerCase() !== this.displayName
                ) {
                    return [];
                }
                return [{ budget, member }];
            })
            .sort((left, right) => {
                if (left.budget.id === this.mainBudgetId) {
                    return -1;
                }
                if (right.budget.id === this.mainBudgetId) {
                    return 1;
                }
                return left.member.displayName.localeCompare(
                    right.member.displayName
                );
            })
            .map(({ budget, member }) => ({
                budgetId: budget.id,
                name: budget.name,
                defaultCurrency: budget.defaultCurrency,
                countryCode: budget.countryCode,
                createdByUserId: budget.createdByUserId ?? null,
                archivedAt: budget.archivedAt ?? null,
                budgetCreatedAt: budget.createdAt,
                budgetUpdatedAt: budget.updatedAt,
                userId: member.userId,
                displayName: member.displayName,
                role: member.role,
                canCreateTransactions: member.canCreateTransactions,
                canUpdateTransactions: member.canUpdateTransactions,
                canDeleteTransactions: member.canDeleteTransactions,
                canManageCategories: member.canManageCategories,
                canManageVendors: member.canManageVendors,
                canManageTags: member.canManageTags,
                canManageMembers: member.canManageMembers,
                memberCreatedAt: member.createdAt,
                memberUpdatedAt: member.updatedAt
            }));
    }

    private memberRows() {
        return this.data.members
            .filter(member => {
                if (
                    this.userId !== undefined &&
                    member.userId !== this.userId
                ) {
                    return false;
                }
                if (
                    this.budgetId !== undefined &&
                    member.budgetId !== this.budgetId
                ) {
                    return false;
                }
                return true;
            })
            .map(member => {
                const user = this.data.users.find(
                    item => item.id === member.userId
                );
                return {
                    budgetId: member.budgetId,
                    userId: member.userId,
                    email: user?.email ?? '',
                    avatarUrl: user?.avatarUrl ?? null,
                    avatarImageMimeType: user?.avatarImageMimeType ?? null,
                    avatarImageFileName: user?.avatarImageFileName ?? null,
                    avatarImageUpdatedAt: user?.avatarImageUpdatedAt ?? null,
                    displayName: member.displayName,
                    role: member.role,
                    canCreateTransactions: member.canCreateTransactions,
                    canUpdateTransactions: member.canUpdateTransactions,
                    canDeleteTransactions: member.canDeleteTransactions,
                    canManageCategories: member.canManageCategories,
                    canManageVendors: member.canManageVendors,
                    canManageTags: member.canManageTags,
                    canManageMembers: member.canManageMembers,
                    createdAt: member.createdAt,
                    updatedAt: member.updatedAt
                };
            })
            .sort((left, right) => left.email.localeCompare(right.email));
    }

    first(): Promise<object | undefined> {
        return Promise.resolve(this.rows()[0]);
    }

    select(): Promise<object[]> {
        if (this.joinedUsers) {
            return Promise.resolve(this.memberRows());
        }
        return Promise.resolve(this.rows());
    }
}

function user(
    id: number,
    email: string,
    overrides: Partial<UserDb> = {}
): UserDb {
    return {
        id,
        email,
        passwordHash: 'hash',
        emailVerified: true,
        emailVerificationTokenHash: undefined,
        emailVerificationExpiresAt: undefined,
        role: 'user',
        authProvider: 'local',
        defaultCurrency: 'USD',
        countryCode: 'US',
        timezone: 'UTC',
        mainBudgetId: 1,
        weeklyEmailReportEnabled: true,
        monthlyEmailReportEnabled: true,
        createdAt: timestamp,
        updatedAt: timestamp,
        ...overrides
    } as UserDb;
}

function budget(
    id: number,
    name: string,
    overrides: Partial<BudgetDb> = {}
): BudgetDb {
    return {
        id,
        name,
        defaultCurrency: 'USD',
        countryCode: 'US',
        createdByUserId: 1,
        archivedAt: null,
        createdAt: timestamp,
        updatedAt: timestamp,
        ...overrides
    } as BudgetDb;
}

function member(
    budgetId: number,
    userId: number,
    role: 'admin' | 'member' = 'admin',
    overrides: Partial<BudgetMemberDb> = {}
): BudgetMemberDb {
    const permissions =
        role === 'admin'
            ? adminBudgetPermissions
            : defaultMemberBudgetPermissions;
    return {
        budgetId,
        userId,
        displayName: 'Main',
        role,
        canCreateTransactions: permissions.canCreateTransactions,
        canUpdateTransactions: permissions.canUpdateTransactions,
        canDeleteTransactions: permissions.canDeleteTransactions,
        canManageCategories: permissions.canManageCategories,
        canManageVendors: permissions.canManageVendors,
        canManageTags: permissions.canManageTags,
        canManageMembers: permissions.canManageMembers,
        createdAt: timestamp,
        updatedAt: timestamp,
        ...overrides
    };
}

function invitation(
    budgetId: number,
    email: string,
    token: string,
    overrides: Partial<BudgetInvitationDb> = {}
): BudgetInvitationDb {
    return {
        id: 1,
        budgetId,
        invitedByUserId: 1,
        email,
        role: 'member',
        canCreateTransactions: true,
        canUpdateTransactions: false,
        canDeleteTransactions: false,
        canManageCategories: false,
        canManageVendors: false,
        canManageTags: false,
        canManageMembers: false,
        tokenHash: hashBudgetInvitationToken(token),
        expiresAt: new Date('2026-06-08T00:00:00.000Z'),
        consumedAt: undefined,
        createdAt: timestamp,
        updatedAt: timestamp,
        ...overrides
    } as BudgetInvitationDb;
}

function makeDb(overrides: Partial<TestData> = {}) {
    const data: TestData = {
        users: [
            user(1, 'owner@example.com'),
            user(2, 'member@example.com', { mainBudgetId: undefined })
        ],
        budgets: [
            budget(1, 'Main'),
            budget(2, 'Travel'),
            budget(3, 'Old budget', {
                archivedAt: new Date('2026-05-01T00:00:00.000Z')
            })
        ],
        members: [
            member(1, 1, 'admin', { displayName: 'Main' }),
            member(2, 1, 'admin', { displayName: 'Travel' }),
            member(3, 1, 'admin', { displayName: 'Old budget' })
        ],
        invitations: [],
        budgetFavoriteCurrencies: [],
        nextBudgetId: 10,
        nextInvitationId: 10,
        ...overrides
    };

    const db = {} as AppDb;
    Object.assign(db, {
        users: {
            find: async (id: number) => data.users.find(item => item.id === id),
            where: <TValue>(selector: (row: UserDb) => TValue, value: TValue) =>
                new TestQuery(data.users).where(selector, value)
        },
        budgets: {
            find: async (id: number) =>
                data.budgets.find(item => item.id === id),
            insert: async (values: Partial<BudgetDb>) => {
                const row = budget(
                    data.nextBudgetId++,
                    values.name ?? 'Budget',
                    {
                        ...values,
                        id: data.nextBudgetId - 1
                    }
                );
                data.budgets.push(row);
                return row;
            },
            where: <TValue>(
                selector: (row: BudgetDb) => TValue,
                value: TValue
            ) => new TestQuery(data.budgets).where(selector, value)
        },
        transactions: {
            whereIn: () => {
                const query = {
                    orderBy: () => query,
                    select: async () => []
                };
                return query;
            }
        },
        budgetMembers: {
            include: (
                selector: (relations: {
                    readonly budget: 'budget';
                    readonly user: 'user';
                }) => 'budget' | 'user'
            ) => {
                const relation = selector({
                    budget: 'budget',
                    user: 'user'
                });
                const rows: object[] = [];
                for (const item of data.members) {
                    if (relation === 'budget') {
                        const related = data.budgets.find(
                            budget => budget.id === item.budgetId
                        );
                        if (related) {
                            rows.push({ ...item, budget: related });
                        }
                        continue;
                    }
                    const related = data.users.find(
                        user => user.id === item.userId
                    );
                    if (related) {
                        rows.push({ ...item, user: related });
                    }
                }
                return new TestQuery(rows);
            },
            insert: async (values: Partial<BudgetMemberDb>) => {
                const row = member(
                    values.budgetId ?? 0,
                    values.userId ?? 0,
                    values.role === 'member' ? 'member' : 'admin',
                    values
                );
                data.members.push(row);
                return row;
            },
            where: <TValue>(
                selector: (row: BudgetMemberDb) => TValue,
                value: TValue
            ) => new TestQuery(data.members).where(selector, value)
        },
        budgetFavoriteCurrencies: {
            whereIn: vi.fn(
                (
                    selector: (
                        row: TestData['budgetFavoriteCurrencies'][number]
                    ) => number,
                    values: readonly number[]
                ) =>
                    new TestQuery(data.budgetFavoriteCurrencies).whereIn(
                        selector,
                        values
                    )
            ),
            where: <TValue>(
                selector: (
                    row: TestData['budgetFavoriteCurrencies'][number]
                ) => TValue,
                value: TValue
            ) =>
                new TestQuery(data.budgetFavoriteCurrencies).where(
                    selector,
                    value
                ),
            insertMany: async (
                values: TestData['budgetFavoriteCurrencies']
            ) => {
                data.budgetFavoriteCurrencies.push(...values);
                return values;
            }
        },
        budgetInvitations: {
            insert: async (values: Partial<BudgetInvitationDb>) => {
                const row = {
                    ...invitation(
                        values.budgetId ?? 0,
                        values.email ?? '',
                        'generated-token',
                        values
                    ),
                    id: data.nextInvitationId++
                } as BudgetInvitationDb;
                data.invitations.push(row);
                return row;
            },
            where: <TValue>(
                selector: (row: BudgetInvitationDb) => TValue,
                value: TValue
            ) => new TestQuery(data.invitations).where(selector, value)
        },
        knex: (table: string) => {
            if (table === 'budget_members as member') {
                return new BudgetListQuery(data);
            }
            if (table === 'budget_members') {
                return {
                    insert: (row: Record<string, unknown>) => ({
                        onConflict: () => ({
                            merge: async () => {
                                const budgetId = Number(row.budget_id);
                                const userId = Number(row.user_id);
                                const next = member(
                                    budgetId,
                                    userId,
                                    row.role === 'admin' ? 'admin' : 'member',
                                    {
                                        displayName: String(
                                            row.display_name ?? 'Shared budget'
                                        ),
                                        canCreateTransactions: Boolean(
                                            row.can_create_transactions
                                        ),
                                        canUpdateTransactions: Boolean(
                                            row.can_update_transactions
                                        ),
                                        canDeleteTransactions: Boolean(
                                            row.can_delete_transactions
                                        ),
                                        canManageCategories: Boolean(
                                            row.can_manage_categories
                                        ),
                                        canManageVendors: Boolean(
                                            row.can_manage_vendors
                                        ),
                                        canManageTags: Boolean(
                                            row.can_manage_tags
                                        ),
                                        canManageMembers: Boolean(
                                            row.can_manage_members
                                        )
                                    }
                                );
                                const existing = data.members.find(
                                    item =>
                                        item.budgetId === budgetId &&
                                        item.userId === userId
                                );
                                if (existing) {
                                    Object.assign(existing, next);
                                } else {
                                    data.members.push(next);
                                }
                            }
                        })
                    })
                };
            }
            if (table === 'transactions') {
                const query = {
                    whereIn: () => query,
                    orderBy: () => query,
                    select: async () => []
                };
                return query;
            }
            throw new Error(`Unexpected table ${table}`);
        },
        transaction: async <T>(callback: (trx: AppDb) => Promise<T>) =>
            callback(db)
    });

    queryData.set(db, data);
    queryData.set(db.knex, data);
    return { data, db };
}

afterEach(() => {
    vi.useRealTimers();
    sendEmailMock.mockReset();
});

describe('budget lifecycle', () => {
    it('rejects case-insensitive active names and permits archived names and self renames', async () => {
        const { db } = makeDb();
        await expect(
            createBudget(db, 1, { name: 'tRaVeL', favoriteCurrencies: [] })
        ).rejects.toThrow('You already have an active budget with this name.');
        await expect(
            updateBudget(db, 1, 2, { name: 'TRAVEL' })
        ).resolves.toMatchObject({ name: 'TRAVEL' });
        await expect(
            createBudget(db, 1, { name: 'Old budget', favoriteCurrencies: [] })
        ).resolves.toMatchObject({ name: 'Old budget' });
    });

    it('treats wildcard characters literally and scopes duplicate checks to the user', async () => {
        const { db } = makeDb();
        await expect(
            createBudget(db, 1, { name: 'Travel_%', favoriteCurrencies: [] })
        ).resolves.toMatchObject({ name: 'Travel_%' });
        await expect(
            createBudget(db, 2, { name: 'Travel', favoriteCurrencies: [] })
        ).resolves.toMatchObject({ name: 'Travel' });
    });

    it('prevents removing or demoting the last admin, but permits changes with another admin', async () => {
        const { db, data } = makeDb();
        await expect(removeBudgetMember(db, 1, 2, 1)).rejects.toThrow(
            'A budget must have at least one admin.'
        );
        await expect(
            updateBudgetMember(db, 1, 2, 1, {
                role: 'member',
                permissions: defaultMemberBudgetPermissions
            })
        ).rejects.toThrow('A budget must have at least one admin.');
        data.members.push(member(2, 2));
        await expect(
            updateBudgetMember(db, 1, 2, 2, {
                role: 'member',
                permissions: defaultMemberBudgetPermissions
            })
        ).resolves.toMatchObject({ role: 'member' });
        Object.assign(
            data.members.find(row => row.budgetId === 2 && row.userId === 2)!,
            { role: 'admin' }
        );
        await expect(removeBudgetMember(db, 1, 2, 2)).resolves.toBeUndefined();
    });

    it('lists active, archived, and all budgets separately', async () => {
        const { db } = makeDb();

        await expect(listBudgets(db, 1)).resolves.toMatchObject([
            { name: 'Main', archivedAt: null },
            { name: 'Travel', archivedAt: null }
        ]);
        await expect(listBudgets(db, 1, 'archived')).resolves.toMatchObject([
            { name: 'Old budget', archivedAt: expect.any(Date) }
        ]);
        await expect(listBudgets(db, 1, 'all')).resolves.toMatchObject([
            { name: 'Main' },
            { name: 'Old budget' },
            { name: 'Travel' }
        ]);
    });

    it('loads normalized favorite currencies for all listed budgets with one scoped query', async () => {
        const { db } = makeDb({
            budgetFavoriteCurrencies: [
                { budgetId: 1, currency: ' usd ' },
                { budgetId: 1, currency: 'eur' },
                { budgetId: 2, currency: 'gbp' },
                { budgetId: 3, currency: 'jpy' },
                { budgetId: 999, currency: 'cad' }
            ]
        });

        const result = await listBudgets(db, 1);

        expect(
            result.map(row => ({
                id: row.id,
                favorites: row.favoriteCurrencies
            }))
        ).toEqual([
            { id: 1, favorites: ['EUR', 'USD'] },
            { id: 2, favorites: ['GBP'] }
        ]);
        expect(
            db.budgetFavoriteCurrencies.whereIn
        ).toHaveBeenCalledExactlyOnceWith(expect.any(Function), [1, 2]);
    });

    it('retains budgets without favorite currencies', async () => {
        const { db } = makeDb();
        const result = await listBudgets(db, 1);
        expect(result.map(row => row.favoriteCurrencies)).toEqual([[], []]);
        expect(db.budgetFavoriteCurrencies.whereIn).toHaveBeenCalledTimes(1);
    });

    it('deduplicates budget IDs before loading favorites', async () => {
        const { db, data } = makeDb();
        // A duplicate query row must not duplicate the IN bindings or reads.
        data.members.push(member(2, 1, 'admin', { displayName: 'Travel' }));
        await listBudgets(db, 1);
        expect(
            db.budgetFavoriteCurrencies.whereIn
        ).toHaveBeenCalledExactlyOnceWith(expect.any(Function), [1, 2]);
    });

    it('does not query favorites when the filtered budget list is empty', async () => {
        const { db } = makeDb({
            budgets: [budget(1, 'Main'), budget(2, 'Travel')]
        });
        await expect(listBudgets(db, 1, 'archived')).resolves.toEqual([]);
        expect(db.budgetFavoriteCurrencies.whereIn).not.toHaveBeenCalled();
    });

    it('renames, archives, and restores non-main budgets', async () => {
        vi.useFakeTimers();
        vi.setSystemTime(new Date('2026-06-02T00:00:00.000Z'));
        const { db } = makeDb();

        const renamed = await updateBudget(db, 1, 2, {
            defaultCurrency: 'eur',
            name: '  Shared travel  '
        });

        expect(renamed.name).toBe('Shared travel');
        expect(renamed.defaultCurrency).toBe('EUR');

        const archived = await updateBudget(db, 1, 2, { archived: true });

        expect(archived.archivedAt).toEqual(
            new Date('2026-06-02T00:00:00.000Z')
        );
        await expect(resolveBudgetAccess(db, 1, 2)).rejects.toBeInstanceOf(
            BudgetAccessError
        );

        const restored = await updateBudget(db, 1, 2, { archived: false });

        expect(restored.archivedAt).toBeNull();
        await expect(resolveBudgetAccess(db, 1, 2)).resolves.toBeTruthy();
    });

    it('does not archive the main budget or delete active budgets', async () => {
        const { db } = makeDb();

        await expect(
            updateBudget(db, 1, 1, { archived: true })
        ).rejects.toBeInstanceOf(BudgetMemberError);
        await expect(deleteBudget(db, 1, 1)).rejects.toBeInstanceOf(
            BudgetMemberError
        );
        await expect(deleteBudget(db, 1, 2)).rejects.toBeInstanceOf(
            BudgetMemberError
        );
    });

    it('deletes archived non-main budgets permanently', async () => {
        const { data, db } = makeDb();

        await deleteBudget(db, 1, 3);

        expect(data.budgets.map(item => item.id)).toEqual([1, 2]);
    });
});

describe('budget invitations', () => {
    it('lists active members and invitation statuses for admin access management', async () => {
        vi.useFakeTimers();
        vi.setSystemTime(new Date('2026-07-01T00:00:00.000Z'));
        const { db } = makeDb({
            invitations: [
                invitation(2, 'pending@example.com', 'join-token', {
                    expiresAt: new Date('2026-07-14T00:00:00.000Z'),
                    id: 7
                })
            ],
            members: [
                member(1, 1, 'admin', { displayName: 'Main' }),
                member(2, 1, 'admin', { displayName: 'Travel' }),
                member(2, 2, 'member', { displayName: 'Shared travel' })
            ]
        });

        const rows = await listBudgetAccess(db, 1, 2);

        expect(rows).toMatchObject([
            {
                status: 'active',
                email: 'member@example.com',
                user: {
                    displayName: 'Shared travel',
                    email: 'member@example.com',
                    userId: 2
                }
            },
            {
                status: 'active',
                email: 'owner@example.com',
                role: 'admin',
                user: {
                    displayName: 'Travel',
                    email: 'owner@example.com',
                    userId: 1
                }
            },
            {
                status: 'pending',
                email: 'pending@example.com',
                invitationId: 7
            }
        ]);
    });

    it('invites another user to Main without requiring a shared rename', async () => {
        const { data, db } = makeDb();

        await expect(
            inviteBudgetMember(db, config, 1, 1, {
                email: 'member@example.com',
                role: 'member'
            })
        ).resolves.toEqual({
            message:
                'If that email belongs to an xpenser user, a budget invitation has been sent.'
        });
        expect(data.invitations).toHaveLength(1);
        expect(sendEmailMock).toHaveBeenCalledOnce();
    });

    it('rejects archived budget invitations before adding membership', async () => {
        const { data, db } = makeDb({
            invitations: [
                invitation(3, 'member@example.com', 'join-token', {
                    id: 7
                })
            ]
        });

        await expect(
            acceptBudgetInvitation(db, 2, 'join-token', 'Shared travel')
        ).rejects.toBeInstanceOf(BudgetInvitationInvalidError);
        expect(
            data.members.some(item => item.budgetId === 3 && item.userId === 2)
        ).toBe(false);
        expect(data.invitations[0]?.consumedAt).toBeUndefined();
    });
});
