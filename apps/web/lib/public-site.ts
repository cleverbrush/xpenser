import type { Metadata, MetadataRoute } from 'next';

type MarketingSection = {
    readonly body: string;
    readonly title: string;
};

export type PublicMarketingPage = {
    readonly description: string;
    readonly eyebrow: string;
    readonly h1: string;
    readonly metadataTitle: string;
    readonly navLabel: string;
    readonly path: string;
    readonly priority: number;
    readonly proofItems: readonly string[];
    readonly sections: readonly MarketingSection[];
};

export type PublicUtilityPage = {
    readonly description: string;
    readonly h1: string;
    readonly metadataTitle: string;
    readonly navLabel: string;
    readonly path: string;
    readonly priority: number;
};

export type JsonLdData = Record<string, unknown>;

export const publicSiteOrigin = (
    process.env.APP_URL ?? 'https://xpenser.cleverbrush.com'
).replace(/\/$/, '');

export const publicPageLastModified = '2026-06-10';
export const noIndexRobots = {
    index: false,
    follow: true
} as const;

export const appScreenshot = {
    alt: 'xpenser dashboard month view showing income, expenses, net total, and category detail',
    height: 1473,
    src: '/screenshots/dashboard-month.png',
    width: 1440
} as const;

export const transactionsScreenshot = {
    alt: 'xpenser transactions table showing categories, vendors, amounts, and transaction dates',
    height: 1440,
    src: '/screenshots/transactions.png',
    width: 1440
} as const;

export const apiSettingsScreenshot = {
    alt: 'xpenser preferences screen showing API keys and MCP setup instructions',
    height: 2307,
    src: '/screenshots/preferences-mcp-email.png',
    width: 1440
} as const;

export const openApiSpecPath = '/api/openapi.json';
export const mcpEndpointPath = '/api/mcp';

export const apiDocsPage = {
    description:
        'Explore the generated xpenser OpenAPI reference for categories, vendors, transactions, stats, API keys, and MCP-related endpoints.',
    h1: 'xpenser API reference',
    metadataTitle: 'API Reference',
    navLabel: 'API docs',
    path: '/api-docs',
    priority: 0.7
} as const satisfies PublicUtilityPage;

export const publicMarketingPages = [
    {
        description:
            'xpenser is an open-source, self-hostable personal finance tracker for income, expenses, dashboards, multi-currency reports, API access, MCP, and Telegram workflows.',
        eyebrow: 'Open-source personal finance',
        h1: 'Self-hosted personal finance tracking with xpenser',
        metadataTitle: 'Self-hosted Personal Finance Tracking',
        navLabel: 'Overview',
        path: '/',
        priority: 1,
        proofItems: [
            'Expense tracking workflows',
            'Self-hostable finance app',
            'Multi-currency tracking',
            'OpenAPI and MCP access',
            'Telegram bot integration',
            'Cleverbrush reference code',
            'MIT licensed',
            'Early project'
        ],
        sections: [
            {
                body: 'Track income, expenses, refunds, and returns with categories, vendors, notes, dates, and currency context.',
                title: 'Structured finance tracking'
            },
            {
                body: 'Review daily, weekly, monthly, quarterly, and yearly dashboards with category splits and trend context.',
                title: 'Dashboards and reports'
            },
            {
                body: 'Connect through API keys, a typed client, MCP tools, and Telegram bot workflows when the web UI is not the right surface.',
                title: 'Connected entry points'
            }
        ]
    },
    {
        description:
            'Run xpenser as a self-hosted personal finance tracker with Docker Compose, a web app, private API service, PostgreSQL, telemetry, and open source code.',
        eyebrow: 'Self-hostable finance app',
        h1: 'Self-hosted personal finance tracker',
        metadataTitle: 'Self-hosted Personal Finance Tracker',
        navLabel: 'Self-hosted',
        path: '/self-hosted-personal-finance-tracker',
        priority: 0.9,
        proofItems: [
            'Docker Compose deployment',
            'Private API service',
            'PostgreSQL storage',
            'Telemetry-ready runtime'
        ],
        sections: [
            {
                body: 'Run the web app, API, PostgreSQL, and observability services from the repository, then put your reverse proxy in front of the public web app.',
                title: 'Own the deployment'
            },
            {
                body: 'Keep everyday finance workflows in a structured app instead of a spreadsheet: categories, vendors, reports, multi-currency conversion, and searchable history.',
                title: 'Own the finance workflow'
            },
            {
                body: 'Inspect the MIT licensed source, adapt the Cleverbrush contracts, and keep external integrations optional until they fit your setup.',
                title: 'Own the implementation'
            }
        ]
    },
    {
        description:
            'xpenser is an open-source expense tracker for recording expenses, income, refunds, vendors, categories, multi-currency transactions, and finance reports.',
        eyebrow: 'Open-source expense tracking',
        h1: 'Open-source expense tracker',
        metadataTitle: 'Open-source Expense Tracker',
        navLabel: 'Expense tracker',
        path: '/open-source-expense-tracker',
        priority: 0.85,
        proofItems: [
            'Expense and income records',
            'Vendor history',
            'Category reports',
            'MIT licensed source'
        ],
        sections: [
            {
                body: 'Record expenses, income, refunds, and returns with category, note, date, vendor, and currency fields that support real personal finance history.',
                title: 'Track more than simple expenses'
            },
            {
                body: 'Use dashboards and reports to review daily through yearly totals, net changes, category detail, and trends across the same underlying transaction data.',
                title: 'Analyze spending patterns'
            },
            {
                body: 'Study or extend the source when the hosted app is not enough, including forms, typed contracts, API handlers, and integration workflows.',
                title: 'Extend the product'
            }
        ]
    },
    {
        description:
            'Use xpenser with OpenAPI docs, API keys, typed client access, and MCP tools for personal finance data, including vendors, categories, transactions, and agent workflows.',
        eyebrow: 'API and MCP access',
        h1: 'Personal finance API and MCP access',
        metadataTitle: 'Personal Finance API and MCP Access',
        navLabel: 'API and MCP',
        path: '/personal-finance-api-mcp',
        priority: 0.8,
        proofItems: [
            'OpenAPI reference',
            'API key access',
            'Typed Node client',
            'MCP server tools',
            'Telegram workflows'
        ],
        sections: [
            {
                body: 'Create API keys for durable external access, inspect the generated OpenAPI reference, and use the typed client around the same contracts that drive the web app and API handlers.',
                title: 'Typed API access'
            },
            {
                body: 'Expose approved vendors, categories, and transactions through MCP tools so agents can read or manage finance data through explicit tool calls.',
                title: 'Agent-ready MCP workflows'
            },
            {
                body: 'Use Telegram bot workflows alongside the web UI when chat-based finance capture or review fits the moment better than a dashboard.',
                title: 'Chat and service integrations'
            }
        ]
    }
] as const satisfies readonly PublicMarketingPage[];

export const publicSeoPages = publicMarketingPages.filter(
    page => page.path !== '/'
);

export const publicUtilityPages = [apiDocsPage] as const;

export function publicUrl(path = '/') {
    return new URL(path, `${publicSiteOrigin}/`).toString();
}

export function getPublicMarketingPage(path: string): PublicMarketingPage {
    const page = publicMarketingPages.find(item => item.path === path);
    if (!page) {
        throw new Error(`Unknown public marketing page: ${path}`);
    }

    return page;
}

export function createPublicPageMetadata(page: PublicMarketingPage): Metadata {
    const canonical = publicUrl(page.path);
    const imageUrl = publicUrl('/og-image.png');

    return {
        title: page.metadataTitle,
        description: page.description,
        alternates: {
            canonical
        },
        openGraph: {
            type: 'website',
            url: canonical,
            siteName: 'xpenser',
            title: `${page.metadataTitle} | xpenser`,
            description: page.description,
            images: [
                {
                    url: imageUrl,
                    width: 1200,
                    height: 630,
                    alt: 'xpenser personal finance app dashboard preview'
                }
            ]
        },
        twitter: {
            card: 'summary_large_image',
            title: `${page.metadataTitle} | xpenser`,
            description: page.description,
            images: [imageUrl]
        }
    };
}

export function getPublicSitemap(): MetadataRoute.Sitemap {
    return [...publicMarketingPages, ...publicUtilityPages].map(page => ({
        url: publicUrl(page.path),
        lastModified: new Date(`${publicPageLastModified}T00:00:00.000Z`),
        changeFrequency: page.path === '/' ? 'weekly' : 'monthly',
        priority: page.priority
    }));
}

export function createPublicPageJsonLd(page: PublicMarketingPage): JsonLdData {
    const canonical = publicUrl(page.path);
    const websiteId = `${publicUrl('/')}#website`;
    const organizationId = `${publicUrl('/')}#organization`;
    const softwareId = `${publicUrl('/')}#software`;
    const graph: JsonLdData[] = [
        {
            '@type': 'Organization',
            '@id': organizationId,
            name: 'Cleverbrush',
            url: 'https://cleverbrush.com',
            sameAs: ['https://github.com/cleverbrush']
        },
        {
            '@type': 'WebSite',
            '@id': websiteId,
            name: 'xpenser',
            url: publicUrl('/'),
            description: getPublicMarketingPage('/').description,
            publisher: { '@id': organizationId },
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
            license: 'https://github.com/cleverbrush/xpenser/blob/main/LICENSE',
            codeRepository: 'https://github.com/cleverbrush/xpenser',
            description:
                'Open-source, self-hostable personal finance tracking with dashboards, reports, API keys, Telegram, and MCP access.'
        },
        {
            '@type': 'WebPage',
            '@id': `${canonical}#webpage`,
            url: canonical,
            name: page.metadataTitle,
            headline: page.h1,
            description: page.description,
            isPartOf: { '@id': websiteId },
            about: { '@id': softwareId },
            inLanguage: 'en'
        }
    ];

    if (page.path !== '/') {
        graph.push({
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
                    name: page.h1,
                    item: canonical
                }
            ]
        });
    }

    return {
        '@context': 'https://schema.org',
        '@graph': graph
    };
}
