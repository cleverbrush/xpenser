import { makePage } from '@keystatic/next/ui/app';
import type { Metadata } from 'next';
import { notFound } from 'next/navigation';
import keystaticConfig, { isKeystaticAdminEnabled } from '@/keystatic.config';
import { noIndexRobots } from '@/lib/public-site';

const KeystaticPage = makePage(keystaticConfig);

export const metadata: Metadata = {
    title: 'xpenser CMS',
    robots: noIndexRobots
};

export default function KeystaticAdminPage() {
    if (!isKeystaticAdminEnabled) {
        notFound();
    }

    return <KeystaticPage />;
}
