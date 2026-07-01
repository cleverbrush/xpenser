import { describe, expect, it } from 'vitest';
import { alternativeSitemapPages } from './alternatives';
import {
    apiDocsPage,
    createPublicPageJsonLd,
    createPublicPageMetadata,
    getPublicMarketingPage,
    getPublicSitemap,
    publicMarketingPages,
    publicPageLastModified,
    publicUrl,
    publicUtilityPages
} from './public-site';

describe('public site SEO helpers', () => {
    it('defines the public organic page cluster', () => {
        expect(publicMarketingPages.map(page => page.path)).toEqual([
            '/',
            '/self-hosted-personal-finance-tracker',
            '/open-source-expense-tracker',
            '/personal-finance-api-mcp'
        ]);
        expect(publicUtilityPages.map(page => page.path)).toEqual([
            '/blog',
            '/api-docs'
        ]);
        expect(apiDocsPage.navLabel).toBe('API docs');
    });

    it('builds canonical metadata for each public page', () => {
        for (const page of publicMarketingPages) {
            const metadata = createPublicPageMetadata(page);

            expect(metadata.title).toBe(page.metadataTitle);
            expect(metadata.description).toBe(page.description);
            expect(metadata.alternates?.canonical).toBe(publicUrl(page.path));
        }
    });

    it('builds a sitemap with only canonical public URLs', () => {
        const sitemap = getPublicSitemap();

        expect(sitemap.map(entry => entry.url)).toEqual(
            [
                ...publicMarketingPages,
                ...publicUtilityPages,
                ...alternativeSitemapPages
            ].map(page => publicUrl(page.path))
        );
        expect(sitemap.some(entry => entry.url.includes('/dashboard'))).toBe(
            false
        );
        expect(
            sitemap.some(
                entry =>
                    entry.url === publicUrl('/alternatives/mint-alternative')
            )
        ).toBe(true);
        expect(sitemap.every(entry => entry.lastModified instanceof Date)).toBe(
            true
        );
        expect(
            sitemap.every(
                entry =>
                    entry.lastModified instanceof Date &&
                    entry.lastModified
                        .toISOString()
                        .startsWith(publicPageLastModified)
            )
        ).toBe(true);
    });

    it('builds JSON-LD with webpage and breadcrumb data', () => {
        const page = getPublicMarketingPage(
            '/self-hosted-personal-finance-tracker'
        );
        const jsonLd = createPublicPageJsonLd(page);
        const graph = jsonLd['@graph'];

        expect(Array.isArray(graph)).toBe(true);
        expect(graph).toEqual(
            expect.arrayContaining([
                expect.objectContaining({
                    '@type': 'WebPage',
                    url: publicUrl(page.path),
                    headline: page.h1
                }),
                expect.objectContaining({
                    '@type': 'BreadcrumbList'
                }),
                expect.objectContaining({
                    '@type': 'SoftwareApplication',
                    name: 'xpenser'
                })
            ])
        );
    });
});
