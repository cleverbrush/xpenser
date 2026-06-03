'use client';

import { cn } from '@xpenser/ui';
import {
    ChartSplineIcon,
    CirclePlusIcon,
    CreditCardIcon,
    LayoutDashboardIcon,
    StoreIcon
} from 'lucide-react';
import Link from 'next/link';
import { usePathname } from 'next/navigation';

const items = [
    {
        href: '/dashboard',
        label: 'Dashboard',
        icon: LayoutDashboardIcon
    },
    {
        href: '/transactions',
        label: 'Transactions',
        icon: CreditCardIcon
    },
    {
        href: '/capture',
        label: 'Add',
        icon: CirclePlusIcon
    },
    {
        href: '/merchants',
        label: 'Merchants',
        icon: StoreIcon
    },
    {
        href: '/stats',
        label: 'Reports',
        icon: ChartSplineIcon
    }
] as const;

function isActive(pathname: string, href: string): boolean {
    return pathname === href || pathname.startsWith(`${href}/`);
}

export function MobileTabBar() {
    const pathname = usePathname();

    return (
        <nav className="fixed inset-x-0 bottom-0 z-40 border-t bg-background/95 shadow-lg backdrop-blur sm:hidden">
            <div className="grid grid-cols-5 px-1 pb-[calc(env(safe-area-inset-bottom)+0.25rem)] pt-1">
                {items.map(item => {
                    const active = isActive(pathname, item.href);
                    const Icon = item.icon;
                    return (
                        <Link
                            aria-current={active ? 'page' : undefined}
                            className={cn(
                                'flex min-h-14 flex-col items-center justify-center gap-1 rounded-md px-1 text-[11px] font-medium text-muted-foreground transition-colors',
                                active && 'bg-muted text-foreground'
                            )}
                            href={item.href}
                            key={item.href}
                        >
                            <Icon aria-hidden className="size-5" />
                            <span className="max-w-full truncate">
                                {item.label}
                            </span>
                        </Link>
                    );
                })}
            </div>
        </nav>
    );
}
