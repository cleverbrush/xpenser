import { redirect } from 'next/navigation';
import { auth } from '@/auth';

export const dynamic = 'force-dynamic';

export default async function HomePage() {
    const session = await auth();
    redirect(session?.apiToken ? '/dashboard' : '/login');
}
