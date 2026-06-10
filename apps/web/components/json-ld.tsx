import type { JsonLdData } from '@/lib/public-site';

export function serializeJsonLd(data: JsonLdData): string {
    return JSON.stringify(data).replace(/</g, '\\u003c');
}

export function JsonLdScript({ data }: { readonly data: JsonLdData }) {
    return (
        <script
            // biome-ignore lint/security/noDangerouslySetInnerHtml: JSON-LD must be emitted as a script tag for crawlers.
            dangerouslySetInnerHTML={{ __html: serializeJsonLd(data) }}
            type="application/ld+json"
        />
    );
}
