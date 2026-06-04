/**
 * @vitest-environment jsdom
 */

import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import type { Vendor } from '@xpenser/contracts';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { VendorProfileActions } from './vendor-actions';

const getVendorCandidateDetailsAction = vi.fn();
const searchVendorCandidatesAction = vi.fn();
const updateVendorAction = vi.fn();
const refresh = vi.fn();

vi.mock('next/navigation', () => ({
    useRouter: () => ({ refresh })
}));

vi.mock('@/lib/actions', () => ({
    getVendorCandidateDetailsAction: (query: {
        readonly brandfetchBrandId?: string;
        readonly domain?: string;
    }) => getVendorCandidateDetailsAction(query),
    searchVendorCandidatesAction: (query: string) =>
        searchVendorCandidatesAction(query),
    updateVendorAction: (formData: FormData) => updateVendorAction(formData)
}));

const timestamp = new Date('2026-06-01T00:00:00.000Z');

function vendor(overrides: Partial<Vendor> = {}): Vendor {
    return {
        id: 1,
        name: 'Old Walmart',
        displayName: 'Old Walmart',
        resolvedName: 'Walmart',
        domain: 'old.example',
        transactionCount: 0,
        createdAt: timestamp,
        updatedAt: timestamp,
        ...overrides
    };
}

describe('VendorProfileActions', () => {
    afterEach(() => {
        getVendorCandidateDetailsAction.mockReset();
        searchVendorCandidatesAction.mockReset();
        updateVendorAction.mockReset();
        refresh.mockReset();
    });

    it('edits one display name and reviews Brandfetch suggestions before saving', async () => {
        searchVendorCandidatesAction.mockResolvedValue([
            {
                brandfetchBrandId: 'id_walmart',
                name: 'Walmart',
                domain: 'walmart.com',
                logoUrl: 'https://cdn.brandfetch.io/walmart-search.svg'
            }
        ]);
        getVendorCandidateDetailsAction.mockResolvedValue({
            brandfetchBrandId: 'id_walmart',
            name: 'Walmart',
            domain: 'walmart.com',
            description: 'Retail stores.',
            logoUrl: 'https://cdn.brandfetch.io/walmart.svg',
            primaryColor: '#0071ce'
        });
        updateVendorAction.mockResolvedValue(vendor({ name: 'Walmart' }));

        render(<VendorProfileActions vendor={vendor()} />);

        fireEvent.click(screen.getByRole('button', { name: 'Edit' }));

        expect(screen.getByLabelText('Display name')).toBeTruthy();
        expect(screen.queryByLabelText('Resolved name')).toBeNull();

        fireEvent.change(screen.getByLabelText('Find brand details'), {
            target: { value: 'Walmart' }
        });

        await waitFor(() =>
            expect(searchVendorCandidatesAction).toHaveBeenCalledWith('Walmart')
        );
        const candidateDomain = await screen.findByText('walmart.com');
        fireEvent.click(candidateDomain.closest('button') as HTMLButtonElement);

        await screen.findByText('Review suggested changes');
        expect(screen.getByText('Retail stores.')).toBeTruthy();

        const firstUseButton = screen.getAllByRole('button', {
            name: 'Use'
        })[0];
        expect(firstUseButton).toBeTruthy();
        fireEvent.click(firstUseButton as HTMLButtonElement);
        expect(
            (screen.getByLabelText('Display name') as HTMLInputElement).value
        ).toBe('Walmart');

        fireEvent.click(screen.getByRole('button', { name: 'Save vendor' }));

        await waitFor(() => expect(updateVendorAction).toHaveBeenCalledOnce());
        const formData = updateVendorAction.mock.calls[0]?.[0] as FormData;
        expect(formData.get('name')).toBe('Walmart');
        expect(formData.get('domain')).toBe('old.example');
        expect(formData.get('resolvedName')).toBeNull();
        expect(refresh).toHaveBeenCalledOnce();
    });
});
