'use client';

import Link from 'next/link';
import { usePathname, useSearchParams } from 'next/navigation';
import type { ComponentProps } from 'react';

const periodStatePaths = new Set(['/dashboard', '/vendors']);

type PeriodStateLinkProps = Omit<ComponentProps<typeof Link>, 'href'> & {
    readonly href: string;
};

function pathOnly(href: string): string {
    return href.split('?')[0] ?? href;
}

export function PeriodStateLink({ href, ...props }: PeriodStateLinkProps) {
    const pathname = usePathname();
    const searchParams = useSearchParams();
    const targetPath = pathOnly(href);
    const shouldPreserve =
        periodStatePaths.has(pathname) && periodStatePaths.has(targetPath);

    if (!shouldPreserve) {
        return <Link href={href} {...props} />;
    }

    const params = new URLSearchParams();
    const period = searchParams.get('period');
    const date = searchParams.get('date');
    if (period) {
        params.set('period', period);
    }
    if (date) {
        params.set('date', date);
    }

    const query = params.toString();
    return (
        <Link href={query ? `${targetPath}?${query}` : targetPath} {...props} />
    );
}
