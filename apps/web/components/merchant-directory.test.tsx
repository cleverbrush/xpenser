/**
 * @vitest-environment jsdom
 */

import { render, screen } from '@testing-library/react';
import type { Merchant } from '@xpenser/contracts';
import { describe, expect, it } from 'vitest';
import { MerchantDirectory } from './merchant-directory';

const timestamp = new Date('2026-06-01T00:00:00.000Z');

function merchant(overrides: Partial<Merchant> = {}): Merchant {
    return {
        id: 42,
        name: 'Walmart',
        displayName: 'Walmart',
        brandName: 'Walmart',
        description: 'Retail stores.',
        domain: 'walmart.com',
        enrichmentProvider: 'brandfetch',
        enrichmentStatus: 'success',
        enrichedAt: timestamp,
        logoUrl: 'https://walmart.com/logo.svg',
        primaryColor: '#0071ce',
        suggestedCategoryId: 7,
        suggestedCategoryDisplayName: 'Groceries',
        transactionCount: 3,
        createdAt: timestamp,
        updatedAt: timestamp,
        ...overrides
    };
}

describe('MerchantDirectory', () => {
    it('renders merchant enrichment status and detail links', () => {
        render(<MerchantDirectory merchants={[merchant()]} search="" />);

        expect(screen.getAllByText('Enriched').length).toBeGreaterThan(0);
        expect(screen.getAllByText('Groceries').length).toBeGreaterThan(0);
        expect(screen.getAllByText('3 transactions').length).toBeGreaterThan(0);
        expect(
            screen
                .getAllByRole('link', { name: /walmart/i })
                .some(link => link.getAttribute('href') === '/merchants/42')
        ).toBe(true);
    });

    it('renders the empty state for a filtered directory', () => {
        render(<MerchantDirectory merchants={[]} search="Walmart" />);

        expect(
            screen.getByText('No merchants match this search.')
        ).toBeTruthy();
    });
});
