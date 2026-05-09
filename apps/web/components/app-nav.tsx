import { Button } from '@xpenser/ui';
import Link from 'next/link';
import { logoutAction } from '@/lib/actions';
import { ThemeToggle } from './theme-toggle';

export function AppNav() {
    return (
        <header className="border-b bg-background">
            <div className="mx-auto flex h-14 max-w-6xl items-center justify-between px-4">
                <Link className="font-semibold" href="/dashboard">
                    xpenser
                </Link>
                <nav className="flex items-center gap-2 text-sm">
                    <Button asChild size="sm" variant="ghost">
                        <Link href="/dashboard">Dashboard</Link>
                    </Button>
                    <Button asChild size="sm" variant="ghost">
                        <Link href="/transactions">Transactions</Link>
                    </Button>
                    <Button asChild size="sm" variant="ghost">
                        <Link href="/settings/categories">Categories</Link>
                    </Button>
                    <Button asChild size="sm" variant="ghost">
                        <Link href="/settings/preferences">Preferences</Link>
                    </Button>
                    <ThemeToggle />
                    <form action={logoutAction}>
                        <Button size="sm" type="submit" variant="outline">
                            Sign out
                        </Button>
                    </form>
                </nav>
            </div>
        </header>
    );
}
