import Link from 'next/link';
import { getSession, clearAuthCookie } from '../../lib/auth';
import { redirect } from 'next/navigation';
import { ThemeToggle } from '@xpenser/ui';
import { invalidateUserCache } from '../../lib/cache';

async function logoutAction() {
  'use server';
  await clearAuthCookie();
  redirect('/login');
}

export default async function ProtectedLayout({ children }: { children: React.ReactNode }) {
  const session = await getSession();
  if (!session) redirect('/login');

  return (
    <div className="flex min-h-screen">
      <aside className="w-64 border-r bg-card p-4 flex flex-col">
        <div className="mb-6">
          <h1 className="text-lg font-bold">Xpenser</h1>
          <p className="text-xs text-muted-foreground">User #{session.userId}</p>
        </div>
        <nav className="flex flex-col gap-1 flex-1">
          <Link href="/" className="rounded-md px-3 py-2 text-sm hover:bg-accent">Dashboard</Link>
          <Link href="/transactions" className="rounded-md px-3 py-2 text-sm hover:bg-accent">Transactions</Link>
          <Link href="/settings/categories" className="rounded-md px-3 py-2 text-sm hover:bg-accent">Categories</Link>
          <Link href="/settings/preferences" className="rounded-md px-3 py-2 text-sm hover:bg-accent">Preferences</Link>
        </nav>
        <div className="flex items-center justify-between pt-4 border-t">
          <ThemeToggle />
          <form action={logoutAction}>
            <button type="submit" className="text-xs text-muted-foreground hover:text-foreground">
              Logout
            </button>
          </form>
        </div>
      </aside>
      <main className="flex-1 p-6">{children}</main>
    </div>
  );
}
