import { describe, expect, it } from 'vitest';
import {
    createAlternativeProductJsonLd,
    createAlternativeProductMetadata,
    createAlternativesIndexJsonLd,
    createAlternativesIndexMetadata
} from './alternative-seo';
import { alternativeProducts, alternativesIndexPage } from './alternatives';
import { publicUrl } from './public-site';

describe('alternative SEO helpers', () => {
    it('builds index metadata and collection JSON-LD', () => {
        const metadata = createAlternativesIndexMetadata();
        const jsonLd = createAlternativesIndexJsonLd();

        expect(metadata.title).toBe(alternativesIndexPage.metadataTitle);
        expect(metadata.description).toBe(alternativesIndexPage.description);
        expect(metadata.alternates?.canonical).toBe(
            publicUrl(alternativesIndexPage.path)
        );
        expect(metadata.keywords).toEqual(
            expect.arrayContaining([
                'xpenser alternatives',
                'open-source expense tracker alternatives'
            ])
        );
        expect(jsonLd).toEqual(
            expect.objectContaining({
                '@type': 'CollectionPage',
                url: publicUrl(alternativesIndexPage.path)
            })
        );
        expect(jsonLd.mainEntity).toEqual(
            expect.objectContaining({
                '@type': 'ItemList',
                itemListElement: expect.arrayContaining([
                    expect.objectContaining({
                        name: alternativeProducts[0]?.h1,
                        url: publicUrl(alternativeProducts[0]?.path ?? '/')
                    })
                ])
            })
        );
    });

    it.each(
        alternativeProducts
    )('builds detail metadata and JSON-LD for %s', product => {
        const metadata = createAlternativeProductMetadata(product);
        const jsonLd = createAlternativeProductJsonLd(product);
        const graph = jsonLd['@graph'];

        expect(metadata.title).toBe(product.metadataTitle);
        expect(metadata.description).toBe(product.description);
        expect(metadata.alternates?.canonical).toBe(publicUrl(product.path));
        expect(metadata.keywords).toEqual([...product.keywords]);
        expect(Array.isArray(graph)).toBe(true);
        expect(graph).toEqual(
            expect.arrayContaining([
                expect.objectContaining({
                    '@type': 'WebPage',
                    url: publicUrl(product.path),
                    headline: product.h1,
                    mentions: expect.objectContaining({
                        name: product.name,
                        url: product.sourceUrl
                    })
                }),
                expect.objectContaining({
                    '@type': 'BreadcrumbList'
                }),
                expect.objectContaining({
                    '@type': 'FAQPage'
                })
            ])
        );
    });
});
