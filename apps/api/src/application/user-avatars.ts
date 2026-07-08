import type {
    UserAvatarSummary,
    UserAvatarUploadBody,
    UserPreference
} from '@xpenser/contracts';
import { UserAvatarLimits } from '@xpenser/contracts';
import type { AppDb, TransactionDb, UserDb } from '../db/schemas.js';
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

function avatarUrl(row: UserAvatarRow): string | undefined {
    if (row.avatarImageMimeType) {
        return avatarPath(row.id);
    }
    return row.avatarUrl ?? undefined;
}

export function mapUserAvatarSummary(
    row: UserAvatarRow,
    displayName?: string
): UserAvatarSummary {
    return {
        userId: row.id,
        email: row.email,
        displayName: displayName || undefined,
        avatarUrl: avatarUrl(row)
    };
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

    const rows = (await db.knex('users').whereIn('id', ids).select({
        id: 'id',
        email: 'email',
        avatarUrl: 'avatar_url',
        avatarImageMimeType: 'avatar_image_mime_type',
        avatarImageFileName: 'avatar_image_file_name',
        avatarImageUpdatedAt: 'avatar_image_updated_at'
    })) as UserAvatarRow[];

    return new Map(
        rows.map(row => [
            row.id,
            mapUserAvatarSummary(row, displayNames.get(row.id))
        ])
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
    const row = await db
        .knex('budget_members as requester')
        .join(
            'budget_members as target',
            'target.budget_id',
            'requester.budget_id'
        )
        .where('requester.user_id', requesterUserId)
        .where('target.user_id', targetUserId)
        .first('target.user_id');
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
