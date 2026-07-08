'use client';

import { Avatar, AvatarFallback, AvatarImage, cn } from '@xpenser/ui';

type UserAvatarIdentity = {
    readonly avatarUrl?: string;
    readonly displayName?: string;
    readonly email: string;
};

function fallbackText(user: UserAvatarIdentity): string {
    const source = user.displayName || user.email || 'User';
    return source.slice(0, 2).toUpperCase();
}

export function userAvatarLabel(user: UserAvatarIdentity): string {
    return user.displayName || user.email || 'User';
}

export function UserAvatar({
    avatarUrl,
    className,
    displayName,
    email,
    fallbackClassName,
    imageClassName
}: UserAvatarIdentity & {
    readonly className?: string;
    readonly fallbackClassName?: string;
    readonly imageClassName?: string;
}) {
    const label = userAvatarLabel({ avatarUrl, displayName, email });

    return (
        <Avatar
            aria-label={label}
            className={className}
            role="img"
            title={label}
        >
            <AvatarImage alt="" className={imageClassName} src={avatarUrl} />
            <AvatarFallback className={cn('uppercase', fallbackClassName)}>
                {fallbackText({ avatarUrl, displayName, email })}
            </AvatarFallback>
        </Avatar>
    );
}
