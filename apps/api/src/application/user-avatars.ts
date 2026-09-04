import { query } from '@cleverbrush/knex-schema';
import { mapper } from '@cleverbrush/mapper';
import { number, object, string } from '@cleverbrush/schema';
import type {
    UserAvatarSummary,
    UserAvatarUploadBody,
    UserPreference
} from '@xpenser/contracts';
import { UserAvatarLimits, UserAvatarSummarySchema } from '@xpenser/contracts';
import {
    type AppDb,
    BudgetMemberDbSchema,
    type TransactionDb,
    type UserDb,
    UserDbSchema
} from '../db/schemas.js';
import { getUserPreference } from './users.js';

export class UserAvatarError extends Error {}

type UserAvatarRow = Pick<
    UserDb,
    | 'avatarImageFileName'
    | 'avatarImageMimeType'
    | 'avatarImageUpdatedAt'
    | 'avatarUrl'
    | 'email'
    | 'id'
>;

export type ContributorSummary = {
    readonly contributors: readonly UserAvatarSummary[];
    readonly otherContributorCount: number;
};

export type ContributorBucket = Map<number, Date>;

const avatarPath = (userId: number) => `/app-api/users/${userId}/avatar`;

const UserAvatarSummarySourceSchema = object({
    id: number(),
    email: string(),
    displayName: string().optional(),
    avatarUrl: string().optional(),
    avatarImageMimeType: string().optional()
});

const mapUserAvatar = mapper()
    .configure(
        UserAvatarSummarySourceSchema,
        UserAvatarSummarySchema,
        mapping =>
            mapping
                .for(target => target.userId)
                .from(source => source.id)
                .for(target => target.avatarUrl)
                .compute(source =>
                    source.avatarImageMimeType
                        ? avatarPath(source.id)
                        : source.avatarUrl
                )
    )
    .getMapper(UserAvatarSummarySourceSchema, UserAvatarSummarySchema);

export async function mapUserAvatarSummary(
    row: UserAvatarRow,
    displayName?: string
): Promise<UserAvatarSummary> {
    return mapUserAvatar({
        id: row.id,
        email: row.email,
        displayName: displayName || undefined,
        avatarUrl: row.avatarUrl ?? undefined,
        avatarImageMimeType: row.avatarImageMimeType ?? undefined
    });
}

export async function loadUserAvatarSummaries(
    db: Pick<AppDb, 'knex'>,
    userIds: readonly number[],
    displayNames: ReadonlyMap<number, string> = new Map()
): Promise<ReadonlyMap<number, UserAvatarSummary>> {
    const ids = Array.from(new Set(userIds)).filter(
        id => Number.isSafeInteger(id) && id > 0
    );
    if (ids.length === 0) {
        return new Map();
    }

    const rows = (await query(db.knex, UserDbSchema)
        .whereIn(user => user.id, ids)
        .select(user => ({
            id: user.id,
            email: user.email,
            avatarUrl: user.avatarUrl,
            avatarImageMimeType: user.avatarImageMimeType,
            avatarImageFileName: user.avatarImageFileName,
            avatarImageUpdatedAt: user.avatarImageUpdatedAt
        }))) as UserAvatarRow[];

    const summaries = await Promise.all(
        rows.map(row => mapUserAvatarSummary(row, displayNames.get(row.id)))
    );

    return new Map(
        rows.map((row, index) => [row.id, summaries[index]!] as const)
    );
}

export function recordContributor(
    bucket: ContributorBucket,
    transaction: Pick<TransactionDb, 'occurredAt' | 'userId'>,
    currentUserId?: number
): void {
    if (transaction.userId === currentUserId) {
        return;
    }
    const current = bucket.get(transaction.userId);
    if (!current || transaction.occurredAt > current) {
        bucket.set(transaction.userId, transaction.occurredAt);
    }
}

export function contributorSummary(
    bucket: ContributorBucket | undefined,
    usersById: ReadonlyMap<number, UserAvatarSummary>,
    limit = 5
): ContributorSummary {
    if (!bucket || bucket.size === 0) {
        return { contributors: [], otherContributorCount: 0 };
    }

    const sorted = [...bucket.entries()].sort(
        ([leftId, left], [rightId, right]) => {
            const latestDelta = right.getTime() - left.getTime();
            if (latestDelta !== 0) {
                return latestDelta;
            }
            const leftEmail = usersById.get(leftId)?.email ?? '';
            const rightEmail = usersById.get(rightId)?.email ?? '';
            return leftEmail.localeCompare(rightEmail);
        }
    );
    const knownUsers = sorted
        .map(([userId]) => usersById.get(userId))
        .filter((user): user is UserAvatarSummary => Boolean(user));
    const contributors = knownUsers.slice(0, Math.max(0, limit));
    return {
        contributors,
        otherContributorCount: Math.max(
            0,
            knownUsers.length - contributors.length
        )
    };
}

export function userIdsFromTransactions(
    transactions: readonly Pick<TransactionDb, 'userId'>[],
    currentUserId?: number
): number[] {
    return Array.from(
        new Set(
            transactions
                .map(transaction => transaction.userId)
                .filter(userId => userId !== currentUserId)
        )
    );
}

function imageBytes(base64: string): number {
    try {
        return Buffer.from(base64, 'base64').byteLength;
    } catch {
        return Number.POSITIVE_INFINITY;
    }
}

export async function updateUserAvatar(
    db: AppDb,
    userId: number,
    body: UserAvatarUploadBody
): Promise<UserPreference | undefined> {
    const bytes = imageBytes(body.imageBase64);
    if (bytes <= 0 || bytes > UserAvatarLimits.maxImageBytes) {
        throw new UserAvatarError(
            `Avatar image must be ${UserAvatarLimits.maxImageBytes} bytes or smaller.`
        );
    }

    const updated = await db.users
        .where(user => user.id, userId)
        .update({
            avatarImageBase64: body.imageBase64,
            avatarImageMimeType: body.mimeType,
            avatarImageFileName: body.fileName,
            avatarImageUpdatedAt: new Date(),
            updatedAt: new Date()
        });
    if (updated.length === 0) {
        return undefined;
    }
    return getUserPreference(db, userId);
}

export async function deleteUserAvatar(
    db: AppDb,
    userId: number
): Promise<UserPreference | undefined> {
    const updated = await db.users
        .where(user => user.id, userId)
        .update({
            avatarImageBase64: null,
            avatarImageMimeType: null,
            avatarImageFileName: null,
            avatarImageUpdatedAt: null,
            updatedAt: new Date()
        });
    if (updated.length === 0) {
        return undefined;
    }
    return getUserPreference(db, userId);
}

async function canViewAvatar(
    db: AppDb,
    requesterUserId: number,
    targetUserId: number
): Promise<boolean> {
    if (requesterUserId === targetUserId) {
        return true;
    }
    const requesterBudgetIds = query(db.knex, BudgetMemberDbSchema)
        .where(member => member.userId, requesterUserId)
        .select(member => member.budgetId)
        .toKnexQuery();
    const row = await db.budgetMembers
        .where(member => member.userId, targetUserId)
        .whereIn(member => member.budgetId, requesterBudgetIds)
        .select(member => member.userId)
        .first();
    return Boolean(row);
}

export async function getUserAvatarImage(
    db: AppDb,
    requesterUserId: number,
    targetUserId: number
): Promise<
    | {
          readonly imageBase64: string;
          readonly mimeType: string;
          readonly fileName?: string;
          readonly updatedAt?: Date;
      }
    | undefined
> {
    if (!(await canViewAvatar(db, requesterUserId, targetUserId))) {
        return undefined;
    }

    const user = (await db.users.find(targetUserId)) as UserDb | undefined;
    if (!user?.avatarImageBase64 || !user.avatarImageMimeType) {
        return undefined;
    }
    return {
        imageBase64: user.avatarImageBase64,
        mimeType: user.avatarImageMimeType,
        fileName: user.avatarImageFileName,
        updatedAt: user.avatarImageUpdatedAt
    };
}
