import type { Metadata } from 'next';
import { AmountPrivacyProvider } from '@/components/amount-privacy';
import { AppNav } from '@/components/app-nav';
import { getCurrentUser, getSessionOrRedirect } from '@/lib/api';
import { selectedBudgetForUser } from '@/lib/budgets';
import { webConfig } from '@/lib/config';
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
    const [session, me] = await Promise.all([
        getSessionOrRedirect(),
        getCurrentUser()
    ]);
    const selectedBudget = await selectedBudgetForUser(me);
    return (
        <AmountPrivacyProvider>
            <div className="min-h-dvh bg-background">
                <AppNav
                    budgets={me.budgets}
                    feedbackEnabled={Boolean(webConfig.feedback.webhookUrl)}
                    selectedBudgetId={selectedBudget?.id}
                    timezone={session.user.timezone}
                />
                <main className="mx-auto max-w-6xl px-3 pb-24 pt-4 sm:px-4 sm:py-6">
                    {children}
                </main>
            </div>
        </AmountPrivacyProvider>
    );
}
