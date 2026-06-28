import type { Metadata } from 'next';
import { AmountPrivacyProvider } from '@/components/amount-privacy';
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
    const session = await getSessionOrRedirect();
    return (
        <AmountPrivacyProvider>
            <div className="min-h-dvh bg-background">
                <AppNav timezone={session.user.timezone} />
                <main className="mx-auto max-w-6xl px-3 pb-24 pt-4 sm:px-4 sm:py-6">
                    {children}
                </main>
            </div>
        </AmountPrivacyProvider>
    );
}
