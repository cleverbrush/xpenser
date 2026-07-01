import type { Metadata } from 'next';
import {
    type AlternativeProduct,
    alternativeProducts,
    alternativesIndexPage
} from './alternatives';
import {
    appScreenshot,
    type JsonLdData,
    publicSiteOrigin,
    publicUrl
} from './public-site';

const ogImageAlt = 'xpenser personal finance app dashboard preview';

function pageMetadata({
    description,
    keywords,
    metadataTitle,
    path
}: {
    readonly description: string;
    readonly keywords: readonly string[];
    readonly metadataTitle: string;
    readonly path: string;
}): Metadata {
    const canonical = publicUrl(path);
    const imageUrl = publicUrl('/og-image.png');
    const title = `${metadataTitle} | xpenser`;

    return {
        title: metadataTitle,
        description,
        keywords: [...keywords],
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
        keywords: [
            'xpenser alternatives',
            'personal finance app alternatives',
            'open-source expense tracker alternatives',
            'self-hosted personal finance alternatives',
            'budgeting app competitors'
        ],
        metadataTitle: alternativesIndexPage.metadataTitle,
        path: alternativesIndexPage.path
    });
}

export function createAlternativeProductMetadata(
    product: AlternativeProduct
): Metadata {
    return pageMetadata({
        description: product.description,
        keywords: product.keywords,
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
            },
            {
                '@type': 'FAQPage',
                '@id': `${canonical}#faq`,
                mainEntity: [
                    {
                        '@type': 'Question',
                        name: `Is xpenser a ${product.name} alternative?`,
                        acceptedAnswer: {
                            '@type': 'Answer',
                            text: product.xpenserSummary
                        }
                    },
                    {
                        '@type': 'Question',
                        name: 'Can xpenser be self-hosted?',
                        acceptedAnswer: {
                            '@type': 'Answer',
                            text: 'Yes. xpenser is open source, MIT licensed, and self-hostable from the public repository.'
                        }
                    }
                ]
            }
        ]
    };
}
