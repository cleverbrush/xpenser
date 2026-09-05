import type { Budget } from '@xpenser/contracts';
import { Button } from '@xpenser/ui';
import {
    CirclePlusIcon,
    LogOutIcon,
    SettingsIcon,
    StoreIcon
} from 'lucide-react';
import { logoutAction } from '@/lib/actions';
import { webConfig } from '@/lib/config';
import { AppNavigationLink, AppNavigationPending } from './app-navigation-link';
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
                        <AppNavigationLink
                            className="font-semibold"
                            href="/dashboard"
                        >
                            xpenser
                        </AppNavigationLink>
                        <BudgetSelector
                            budgets={budgets}
                            selectedBudgetId={selectedBudgetId}
                        />
                    </div>
                    <nav className="hidden items-center gap-2 text-sm sm:flex">
                        <Button asChild size="sm" variant="ghost">
                            <PeriodStateLink
                                className="relative"
                                href="/dashboard"
                                timezone={timezone}
                            >
                                Dashboard
                                <AppNavigationPending />
                            </PeriodStateLink>
                        </Button>
                        <Button asChild size="sm" variant="ghost">
                            <PeriodStateLink
                                className="relative"
                                href="/vendors"
                                timezone={timezone}
                            >
                                <StoreIcon aria-hidden className="size-4" />
                                Vendors
                                <AppNavigationPending />
                            </PeriodStateLink>
                        </Button>
                        <Button asChild size="sm" variant="ghost">
                            <AppNavigationLink
                                className="relative"
                                href="/capture"
                            >
                                <CirclePlusIcon
                                    aria-hidden
                                    className="size-4"
                                />
                                Add
                                <AppNavigationPending />
                            </AppNavigationLink>
                        </Button>
                        <Button asChild size="sm" variant="ghost">
                            <PeriodStateLink
                                className="relative"
                                href="/transactions"
                                timezone={timezone}
                            >
                                Transactions
                                <AppNavigationPending />
                            </PeriodStateLink>
                        </Button>
                        <Button asChild size="sm" variant="ghost">
                            <PeriodStateLink
                                className="relative"
                                href="/stats"
                                timezone={timezone}
                            >
                                Reports
                                <AppNavigationPending />
                            </PeriodStateLink>
                        </Button>
                        <Button asChild size="sm" variant="ghost">
                            <AppNavigationLink
                                className="relative"
                                href="/settings/preferences"
                            >
                                Preferences
                                <AppNavigationPending />
                            </AppNavigationLink>
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
                            <AppNavigationLink
                                className="relative"
                                href="/settings/preferences"
                            >
                                <SettingsIcon aria-hidden className="size-4" />
                                <AppNavigationPending />
                            </AppNavigationLink>
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
