import { AppNav } from '@/components/app-nav';
import { getSessionOrRedirect } from '@/lib/api';

export const dynamic = 'force-dynamic';

export default async function ProtectedLayout({
    children
}: {
    readonly children: React.ReactNode;
}) {
    await getSessionOrRedirect();
    return (
        <div className="min-h-screen bg-background">
            <AppNav />
            <main className="mx-auto max-w-6xl px-4 py-6">{children}</main>
        </div>
    );
}
