import { Button } from '@xpenser/ui';
import { LogOutIcon } from 'lucide-react';
import Link from 'next/link';
import { logoutAction } from '@/lib/actions';
import { MobileTabBar } from './mobile-tab-bar';
import { ThemeToggle } from './theme-toggle';

export function AppNav() {
    return (
        <>
            <header className="sticky top-0 z-30 border-b bg-background/95 backdrop-blur">
                <div className="mx-auto flex h-14 max-w-6xl items-center justify-between px-4">
                    <Link className="font-semibold" href="/dashboard">
                        xpenser
                    </Link>
                    <nav className="hidden items-center gap-2 text-sm sm:flex">
                        <Button asChild size="sm" variant="ghost">
                            <Link href="/dashboard">Dashboard</Link>
                        </Button>
                        <Button asChild size="sm" variant="ghost">
                            <Link href="/transactions">Transactions</Link>
                        </Button>
                        <Button asChild size="sm" variant="ghost">
                            <Link href="/stats">Reports</Link>
                        </Button>
                        <Button asChild size="sm" variant="ghost">
                            <Link href="/settings/preferences">
                                Preferences
                            </Link>
                        </Button>
                        <ThemeToggle />
                        <form action={logoutAction}>
                            <Button size="sm" type="submit" variant="outline">
                                Sign out
                            </Button>
                        </form>
                    </nav>
                    <div className="flex items-center gap-1 sm:hidden">
                        <ThemeToggle />
                        <form action={logoutAction}>
                            <Button
                                aria-label="Sign out"
                                size="icon-sm"
                                type="submit"
                                variant="ghost"
                            >
                                <LogOutIcon aria-hidden className="size-4" />
                            </Button>
                        </form>
                    </div>
                </div>
            </header>
            <MobileTabBar />
        </>
    );
}
