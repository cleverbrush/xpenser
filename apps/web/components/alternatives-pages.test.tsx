/**
 * @vitest-environment jsdom
 */

import { render, screen, within } from '@testing-library/react';
import { createElement } from 'react';
import { describe, expect, it } from 'vitest';
import {
    type AlternativeProduct,
    alternativeProducts,
    alternativesIndexPage
} from '@/lib/alternatives';
import {
    AlternativeProductPage,
    AlternativesIndexPage
} from './alternatives-pages';

function expectOutboundLinksNofollow(container: HTMLElement) {
    const outboundLinks = Array.from(
        container.querySelectorAll<HTMLAnchorElement>('a[href^="http"]')
    );

    expect(outboundLinks.length).toBeGreaterThan(0);
    for (const link of outboundLinks) {
        const rel = link.getAttribute('rel') ?? '';

        expect(rel.split(/\s+/)).toEqual(
            expect.arrayContaining(['nofollow', 'noopener', 'noreferrer'])
        );
    }
}

describe('AlternativesIndexPage', () => {
    it('renders the alternatives hub with crawlable competitor links', () => {
        const { container } = render(createElement(AlternativesIndexPage));

        expect(
            screen.getByRole('heading', {
                level: 1,
                name: alternativesIndexPage.h1
            })
        ).toBeTruthy();
        expect(
            screen.getByText(alternativesIndexPage.description)
        ).toBeTruthy();
        expect(screen.getByLabelText('Breadcrumb')).toBeTruthy();

        for (const product of alternativeProducts) {
            expect(
                screen.getByRole('link', { name: product.h1 })
            ).toHaveProperty('href', `http://localhost:3000${product.path}`);
            expect(screen.getByText(product.description)).toBeTruthy();
        }

        expect(
            screen
                .getAllByRole('link', { name: /Open-source tracker/i })
                .some(
                    link =>
                        link.getAttribute('href') ===
                        '/open-source-expense-tracker'
                )
        ).toBe(true);
        expectOutboundLinksNofollow(container);
    });
});

describe('AlternativeProductPage', () => {
    it.each(
        alternativeProducts
    )('renders comparison content for %s', (product: AlternativeProduct) => {
        const { container } = render(
            createElement(AlternativeProductPage, { product })
        );

        expect(
            screen.getByRole('heading', {
                level: 1,
                name: product.h1
            })
        ).toBeTruthy();
        expect(screen.getByText(product.description)).toBeTruthy();
        expect(screen.getByText(product.audience)).toBeTruthy();
        expect(
            screen
                .getAllByRole('link', { name: /Create account/i })
                .some(
                    link =>
                        link.getAttribute('href') === '/register' ||
                        link.getAttribute('href') ===
                            'http://localhost:3000/register'
                )
        ).toBe(true);

        const sourceLink = screen.getByRole('link', {
            name: new RegExp(product.sourceLabel, 'i')
        });
        expect(sourceLink).toHaveProperty('href', product.sourceUrl);
        expect(sourceLink.getAttribute('target')).toBe('_blank');
        expect(sourceLink.getAttribute('rel')?.split(/\s+/)).toEqual(
            expect.arrayContaining(['nofollow', 'noopener', 'noreferrer'])
        );

        const table = screen.getByRole('table', {
            name: new RegExp(`xpenser and ${product.name}`, 'i')
        });
        expect(
            within(table).getByRole('columnheader', { name: 'xpenser' })
        ).toBeTruthy();
        expect(
            within(table).getByRole('columnheader', {
                name: product.name
            })
        ).toBeTruthy();

        for (const row of product.comparisonRows) {
            expect(within(table).getByText(row.feature)).toBeTruthy();
            expect(within(table).getByText(row.xpenser)).toBeTruthy();
            expect(within(table).getByText(row.competitor)).toBeTruthy();
        }

        expect(
            screen.getByRole('heading', {
                level: 2,
                name: `xpenser vs ${product.name}: feature comparison`
            })
        ).toBeTruthy();
        expect(
            screen.getByRole('heading', {
                level: 2,
                name: 'Which product fits better?'
            })
        ).toBeTruthy();
        expect(
            screen.getByRole('heading', {
                level: 2,
                name: 'Decision notes'
            })
        ).toBeTruthy();
        expect(screen.getByText(product.bestForXpenser)).toBeTruthy();
        expect(screen.getByText(product.bestForCompetitor)).toBeTruthy();
        expect(screen.getByText(product.comparisonIntro)).toBeTruthy();
        expectOutboundLinksNofollow(container);
    });
});
