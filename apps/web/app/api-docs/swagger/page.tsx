import type { Metadata } from 'next';
import { SwaggerDocsPage } from '@/components/swagger-docs-page';
import { publicUrl } from '@/lib/public-site';

const canonical = publicUrl('/api-docs/swagger');
const imageUrl = publicUrl('/og-image.png');

export const dynamic = 'force-dynamic';

export const metadata: Metadata = {
    title: 'Swagger API Reference',
    description:
        'Explore the generated xpenser OpenAPI contract in Swagger UI.',
    alternates: {
        canonical
    },
    openGraph: {
        type: 'website',
        url: canonical,
        siteName: 'xpenser',
        title: 'Swagger API Reference | xpenser',
        description:
            'Explore the generated xpenser OpenAPI contract in Swagger UI.',
        images: [
            {
                url: imageUrl,
                width: 1200,
                height: 630,
                alt: 'xpenser Swagger API reference preview'
            }
        ]
    },
    twitter: {
        card: 'summary_large_image',
        title: 'Swagger API Reference | xpenser',
        description:
            'Explore the generated xpenser OpenAPI contract in Swagger UI.',
        images: [imageUrl]
    }
};

export default function SwaggerDocsRoutePage() {
    return <SwaggerDocsPage />;
}
