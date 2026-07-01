import type { Metadata } from 'next';
import {
    type AlternativeProduct,
    alternativeProducts,
    alternativesIndexPage
} from './alternatives';
import {
    appScreenshot,
    type JsonLdData,
    publicPageLastModified,
    publicSiteOrigin,
    publicUrl
} from './public-site';

const ogImageAlt = 'xpenser personal finance app dashboard preview';

function pageMetadata({
    description,
    metadataTitle,
    path
}: {
    readonly description: string;
    readonly metadataTitle: string;
    readonly path: string;
}): Metadata {
    const canonical = publicUrl(path);
    const imageUrl = publicUrl('/og-image.png');
    const title = `${metadataTitle} | xpenser`;

    return {
        title: metadataTitle,
        description,
        alternates: {
            canonical
        },
        openGraph: {
            type: 'website',
            url: canonical,
            siteName: 'xpenser',
            title,
            description,
            images: [
                {
                    url: imageUrl,
                    width: 1200,
                    height: 630,
                    alt: ogImageAlt
                }
            ]
        },
        twitter: {
            card: 'summary_large_image',
            title,
            description,
            images: [imageUrl]
        }
    };
}

export function createAlternativesIndexMetadata(): Metadata {
    return pageMetadata({
        description: alternativesIndexPage.description,
        metadataTitle: alternativesIndexPage.metadataTitle,
        path: alternativesIndexPage.path
    });
}

export function createAlternativeProductMetadata(
    product: AlternativeProduct
): Metadata {
    return pageMetadata({
        description: product.description,
        metadataTitle: product.metadataTitle,
        path: product.path
    });
}

export function createAlternativesIndexJsonLd(): JsonLdData {
    const canonical = publicUrl(alternativesIndexPage.path);

    return {
        '@context': 'https://schema.org',
        '@type': 'CollectionPage',
        '@id': `${canonical}#collection`,
        url: canonical,
        name: alternativesIndexPage.metadataTitle,
        headline: alternativesIndexPage.h1,
        description: alternativesIndexPage.description,
        isPartOf: {
            '@type': 'WebSite',
            '@id': `${publicUrl('/')}#website`,
            name: 'xpenser',
            url: publicSiteOrigin
        },
        mainEntity: {
            '@type': 'ItemList',
            itemListElement: alternativeProducts.map((product, index) => ({
                '@type': 'ListItem',
                position: index + 1,
                name: product.h1,
                url: publicUrl(product.path)
            }))
        }
    };
}

export function createAlternativeProductJsonLd(
    product: AlternativeProduct
): JsonLdData {
    const canonical = publicUrl(product.path);
    const websiteId = `${publicUrl('/')}#website`;
    const softwareId = `${publicUrl('/')}#software`;

    return {
        '@context': 'https://schema.org',
        '@graph': [
            {
                '@type': 'WebSite',
                '@id': websiteId,
                name: 'xpenser',
                url: publicUrl('/'),
                description:
                    'Open-source, self-hostable personal finance tracking with dashboards, reports, API keys, Telegram, and MCP access.',
                inLanguage: 'en'
            },
            {
                '@type': 'SoftwareApplication',
                '@id': softwareId,
                name: 'xpenser',
                applicationCategory: 'FinanceApplication',
                operatingSystem: 'Web',
                url: publicUrl('/'),
                image: publicUrl(appScreenshot.src),
                license:
                    'https://github.com/cleverbrush/xpenser/blob/main/LICENSE',
                codeRepository: 'https://github.com/cleverbrush/xpenser',
                description:
                    'Open-source, self-hostable personal finance tracking with dashboards, reports, API keys, Telegram, and MCP access.'
            },
            {
                '@type': 'WebPage',
                '@id': `${canonical}#webpage`,
                url: canonical,
                name: product.metadataTitle,
                headline: product.h1,
                description: product.description,
                dateModified: publicPageLastModified,
                isPartOf: { '@id': websiteId },
                about: { '@id': softwareId },
                mentions: {
                    '@type': 'SoftwareApplication',
                    name: product.name,
                    url: product.sourceUrl
                },
                inLanguage: 'en'
            },
            {
                '@type': 'BreadcrumbList',
                '@id': `${canonical}#breadcrumb`,
                itemListElement: [
                    {
                        '@type': 'ListItem',
                        position: 1,
                        name: 'xpenser',
                        item: publicUrl('/')
                    },
                    {
                        '@type': 'ListItem',
                        position: 2,
                        name: 'Alternatives',
                        item: publicUrl(alternativesIndexPage.path)
                    },
                    {
                        '@type': 'ListItem',
                        position: 3,
                        name: product.h1,
                        item: canonical
                    }
                ]
            }
        ]
    };
}
