import { redirect } from 'next/navigation';
import { JsonLdScript } from '@/components/json-ld';
import { LandingPage } from '@/components/landing-page';
import { webConfig } from '@/lib/config';
import {
    createPublicPageJsonLd,
    createPublicPageMetadata,
    getPublicMarketingPage
} from '@/lib/public-site';

const page = getPublicMarketingPage('/');

export const dynamic = 'force-dynamic';
export const metadata = createPublicPageMetadata(page);

export default function HomePage() {
    if (webConfig.singleUser?.enabled) {
        redirect('/dashboard');
    }

    return (
        <>
            <JsonLdScript data={createPublicPageJsonLd(page)} />
            <LandingPage />
        </>
    );
}
