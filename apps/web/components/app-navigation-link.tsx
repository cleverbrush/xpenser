'use client';

import { cn, Spinner } from '@xpenser/ui';
import Link, { useLinkStatus } from 'next/link';
import type { ComponentProps, FocusEvent, MouseEvent } from 'react';
import { useState } from 'react';

type AppNavigationLinkProps = Omit<
    ComponentProps<typeof Link>,
    'href' | 'prefetch'
> & {
    readonly href: string;
};

/**
 * Keeps Next's partial route prefetch enabled, then upgrades the destination to
 * a full prefetch only after the user signals intent to follow the link.
 */
export function AppNavigationLink({
    href,
    onFocus,
    onMouseEnter,
    ...props
}: AppNavigationLinkProps) {
    const [intentHref, setIntentHref] = useState<string>();

    function handleFocus(event: FocusEvent<HTMLAnchorElement>) {
        setIntentHref(href);
        onFocus?.(event);
    }

    function handleMouseEnter(event: MouseEvent<HTMLAnchorElement>) {
        setIntentHref(href);
        onMouseEnter?.(event);
    }

    return (
        <Link
            href={href}
            onFocus={handleFocus}
            onMouseEnter={handleMouseEnter}
            prefetch={intentHref === href ? true : null}
            {...props}
        />
    );
}

export function AppNavigationPending({
    className
}: {
    readonly className?: string;
}) {
    const { pending } = useLinkStatus();

    return (
        <span
            aria-hidden="true"
            className={cn(
                'pointer-events-none absolute right-1 top-1 inline-flex size-3 items-center justify-center transition-opacity',
                pending ? 'opacity-100' : 'opacity-0',
                className
            )}
            data-pending={pending ? 'true' : 'false'}
            data-slot="app-navigation-pending"
        >
            {pending ? <Spinner className="size-3" /> : null}
        </span>
    );
}
