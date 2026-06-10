import type { Metadata } from 'next';
import { AppNav } from '@/components/app-nav';
import { getSessionOrRedirect } from '@/lib/api';
import { noIndexRobots } from '@/lib/public-site';

export const dynamic = 'force-dynamic';
export const metadata: Metadata = {
    robots: noIndexRobots
};

export default async function ProtectedLayout({
    children
}: {
    readonly children: React.ReactNode;
}) {
    await getSessionOrRedirect();
    return (
        <div className="min-h-dvh bg-background">
            <AppNav />
            <main className="mx-auto max-w-6xl px-3 pb-24 pt-4 sm:px-4 sm:py-6">
                {children}
            </main>
        </div>
    );
}
