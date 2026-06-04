/**
 * @vitest-environment jsdom
 */

import { render, screen } from '@testing-library/react';
import type { Vendor } from '@xpenser/contracts';
import { describe, expect, it } from 'vitest';
import { VendorDirectory } from './vendor-directory';

const timestamp = new Date('2026-06-01T00:00:00.000Z');

function vendor(overrides: Partial<Vendor> = {}): Vendor {
    return {
        id: 42,
        name: 'Walmart',
        displayName: 'Walmart',
        resolvedName: 'Walmart',
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

describe('VendorDirectory', () => {
    it('renders vendor details without a status badge', () => {
        render(<VendorDirectory vendors={[vendor()]} search="" />);

        expect(
            screen.queryByRole('columnheader', { name: 'Status' })
        ).toBeNull();
        expect(screen.getAllByText('Groceries').length).toBeGreaterThan(0);
        expect(screen.getAllByText('3 transactions').length).toBeGreaterThan(0);
        expect(
            screen
                .getAllByRole('link', { name: /walmart/i })
                .some(
                    link => link.getAttribute('href') === '/settings/vendors/42'
                )
        ).toBe(true);
    });

    it('renders the empty state for a filtered directory', () => {
        render(<VendorDirectory vendors={[]} search="Walmart" />);

        expect(screen.getByText('No vendors match this search.')).toBeTruthy();
    });
});
