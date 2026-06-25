import type { Metadata } from 'next';
import { redirect } from 'next/navigation';
import { ApiDocsPage } from '@/components/api-docs-page';
import { webConfig } from '@/lib/config';
import { apiDocsPage, publicUrl } from '@/lib/public-site';

const canonical = publicUrl(apiDocsPage.path);
const imageUrl = publicUrl('/og-image.png');

export const dynamic = 'force-dynamic';

export const metadata: Metadata = {
    title: apiDocsPage.metadataTitle,
    description: apiDocsPage.description,
    alternates: {
        canonical
    },
    openGraph: {
        type: 'website',
        url: canonical,
        siteName: 'xpenser',
        title: `${apiDocsPage.metadataTitle} | xpenser`,
        description: apiDocsPage.description,
        images: [
            {
                url: imageUrl,
                width: 1200,
                height: 630,
                alt: 'xpenser personal finance app API reference preview'
            }
        ]
    },
    twitter: {
        card: 'summary_large_image',
        title: `${apiDocsPage.metadataTitle} | xpenser`,
        description: apiDocsPage.description,
        images: [imageUrl]
    }
};

export default function ApiDocsRoutePage() {
    if (webConfig.singleUser?.enabled) {
        redirect('/api-docs/swagger');
    }

    return <ApiDocsPage />;
}
