import { redirect } from 'next/navigation';
import { JsonLdScript } from '@/components/json-ld';
import { SeoPage } from '@/components/seo-page';
import { webConfig } from '@/lib/config';
import {
    createPublicPageJsonLd,
    createPublicPageMetadata,
    getPublicMarketingPage
} from '@/lib/public-site';

const page = getPublicMarketingPage('/self-hosted-personal-finance-tracker');

export const dynamic = 'force-dynamic';
export const metadata = createPublicPageMetadata(page);

export default function SelfHostedPersonalFinanceTrackerPage() {
    if (webConfig.singleUser?.enabled) {
        redirect('/dashboard');
    }

    return (
        <>
            <JsonLdScript data={createPublicPageJsonLd(page)} />
            <SeoPage page={page} />
        </>
    );
}
