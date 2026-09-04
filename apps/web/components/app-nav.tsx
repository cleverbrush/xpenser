import type { Budget } from '@xpenser/contracts';
import { Button } from '@xpenser/ui';
import {
    CirclePlusIcon,
    LogOutIcon,
    SettingsIcon,
    StoreIcon
} from 'lucide-react';
import Link from 'next/link';
import { logoutAction } from '@/lib/actions';
import { webConfig } from '@/lib/config';
import { BudgetSelector } from './budget-selector';
import { FeedbackDialog } from './feedback-dialog';
import { MobileTabBar } from './mobile-tab-bar';
import { PeriodStateLink } from './period-state-link';
import { ThemeToggle } from './theme-toggle';

export function AppNav({
    budgets,
    feedbackEnabled,
    selectedBudgetId,
    timezone
}: {
    readonly budgets: readonly Budget[];
    readonly feedbackEnabled: boolean;
    readonly selectedBudgetId?: number;
    readonly timezone: string;
}) {
    return (
        <>
            <header className="sticky top-0 z-30 border-b bg-background/95 backdrop-blur">
                <div className="mx-auto flex h-14 max-w-6xl items-center justify-between px-4">
                    <div className="flex min-w-0 items-center gap-3">
                        <Link className="font-semibold" href="/dashboard">
                            xpenser
                        </Link>
                        <BudgetSelector
                            budgets={budgets}
                            selectedBudgetId={selectedBudgetId}
                        />
                    </div>
                    <nav className="hidden items-center gap-2 text-sm sm:flex">
                        <Button asChild size="sm" variant="ghost">
                            <PeriodStateLink
                                href="/dashboard"
                                timezone={timezone}
                            >
                                Dashboard
                            </PeriodStateLink>
                        </Button>
                        <Button asChild size="sm" variant="ghost">
                            <PeriodStateLink
                                href="/vendors"
                                timezone={timezone}
                            >
                                <StoreIcon aria-hidden className="size-4" />
                                Vendors
                            </PeriodStateLink>
                        </Button>
                        <Button asChild size="sm" variant="ghost">
                            <Link href="/capture">
                                <CirclePlusIcon
                                    aria-hidden
                                    className="size-4"
                                />
                                Add
                            </Link>
                        </Button>
                        <Button asChild size="sm" variant="ghost">
                            <PeriodStateLink
                                href="/transactions"
                                timezone={timezone}
                            >
                                Transactions
                            </PeriodStateLink>
                        </Button>
                        <Button asChild size="sm" variant="ghost">
                            <PeriodStateLink href="/stats" timezone={timezone}>
                                Reports
                            </PeriodStateLink>
                        </Button>
                        <Button asChild size="sm" variant="ghost">
                            <Link href="/settings/preferences">
                                Preferences
                            </Link>
                        </Button>
                        {feedbackEnabled ? <FeedbackDialog /> : null}
                        <ThemeToggle />
                        {webConfig.singleUser?.enabled ? null : (
                            <form action={logoutAction}>
                                <Button
                                    size="sm"
                                    type="submit"
                                    variant="outline"
                                >
                                    Sign out
                                </Button>
                            </form>
                        )}
                    </nav>
                    <div className="flex items-center gap-1 sm:hidden">
                        {feedbackEnabled ? <FeedbackDialog compact /> : null}
                        <ThemeToggle />
                        <Button
                            aria-label="Preferences"
                            asChild
                            size="icon-sm"
                            variant="ghost"
                        >
                            <Link href="/settings/preferences">
                                <SettingsIcon aria-hidden className="size-4" />
                            </Link>
                        </Button>
                        {webConfig.singleUser?.enabled ? null : (
                            <form action={logoutAction}>
                                <Button
                                    aria-label="Sign out"
                                    size="icon-sm"
                                    type="submit"
                                    variant="ghost"
                                >
                                    <LogOutIcon
                                        aria-hidden
                                        className="size-4"
                                    />
                                </Button>
                            </form>
                        )}
                    </div>
                </div>
            </header>
            <MobileTabBar timezone={timezone} />
        </>
    );
}
