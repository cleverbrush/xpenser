import { redirect } from 'next/navigation';
import { auth } from '@/auth';
import { LandingPage } from '@/components/landing-page';

export const dynamic = 'force-dynamic';

export default async function HomePage() {
    const session = await auth();
    if (session?.apiToken) {
        redirect('/dashboard');
    }

    return <LandingPage />;
}
