import { JsonLdScript } from '@/components/json-ld';
import { SeoPage } from '@/components/seo-page';
import {
    createPublicPageJsonLd,
    createPublicPageMetadata,
    getPublicMarketingPage
} from '@/lib/public-site';

const page = getPublicMarketingPage('/self-hosted-personal-finance-tracker');

export const dynamic = 'force-static';
export const metadata = createPublicPageMetadata(page);

export default function SelfHostedPersonalFinanceTrackerPage() {
    return (
        <>
            <JsonLdScript data={createPublicPageJsonLd(page)} />
            <SeoPage page={page} />
        </>
    );
}
