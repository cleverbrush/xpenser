'use client';

import type { UserAvatarSummary } from '@xpenser/contracts';
import { UserAvatar } from './user-avatar';

export function ContributorAvatars({
    className = '',
    contributors,
    otherContributorCount
}: {
    readonly className?: string;
    readonly contributors: readonly UserAvatarSummary[];
    readonly otherContributorCount: number;
}) {
    const visible = contributors.slice(0, 3);
    const hiddenCount =
        Math.max(0, contributors.length - visible.length) +
        Math.max(0, otherContributorCount);
    if (visible.length === 0 && hiddenCount === 0) {
        return null;
    }

    return (
        <div className={`flex shrink-0 items-center -space-x-1 ${className}`}>
            {visible.map(user => (
                <UserAvatar
                    avatarUrl={user.avatarUrl}
                    className="size-5 border border-background"
                    displayName={user.displayName}
                    email={user.email}
                    fallbackClassName="text-[0.58rem]"
                    key={user.userId}
                />
            ))}
            {hiddenCount > 0 ? (
                <span className="flex size-5 items-center justify-center rounded-full border border-background bg-muted text-[0.58rem] font-medium text-muted-foreground">
                    +{hiddenCount}
                </span>
            ) : null}
        </div>
    );
}
