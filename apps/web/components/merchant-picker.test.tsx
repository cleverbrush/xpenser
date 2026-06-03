/**
 * @vitest-environment jsdom
 */

import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import type { Merchant } from '@xpenser/contracts';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { MerchantPicker } from './merchant-picker';

const createMerchantAction = vi.fn();
const searchMerchantBrandsAction = vi.fn();

vi.mock('@/lib/actions', () => ({
    createMerchantAction: (formData: FormData) =>
        createMerchantAction(formData),
    searchMerchantBrandsAction: (query: string) =>
        searchMerchantBrandsAction(query)
}));

const timestamp = new Date('2026-06-01T00:00:00.000Z');

function merchant(overrides: Partial<Merchant> = {}): Merchant {
    return {
        id: 1,
        name: 'Bufet',
        displayName: 'Bufet',
        transactionCount: 0,
        createdAt: timestamp,
        updatedAt: timestamp,
        ...overrides
    };
}

describe('MerchantPicker', () => {
    afterEach(() => {
        createMerchantAction.mockReset();
        searchMerchantBrandsAction.mockReset();
    });

    it('creates a merchant from a Brandfetch search suggestion', async () => {
        const selected = merchant({
            id: 9,
            brandName: 'Bufet',
            domain: 'bufet.ua',
            logoUrl: 'https://cdn.brandfetch.io/bufet/icon.svg'
        });
        createMerchantAction.mockResolvedValue(selected);
        searchMerchantBrandsAction.mockResolvedValue([
            {
                brandId: 'id_bufet',
                name: 'Bufet',
                domain: 'bufet.ua',
                logoUrl: 'https://cdn.brandfetch.io/bufet/icon.svg',
                claimed: true
            }
        ]);
        const onChange = vi.fn();

        render(
            <MerchantPicker
                merchants={[]}
                onChange={onChange}
                selectedMerchantId={null}
            />
        );

        fireEvent.change(screen.getByLabelText('Merchant'), {
            target: { value: 'Bufet' }
        });

        await waitFor(() =>
            expect(searchMerchantBrandsAction).toHaveBeenCalledWith('Bufet')
        );
        const domain = await screen.findByText('bufet.ua');
        const button = domain.closest('button');
        expect(button).toBeTruthy();

        fireEvent.click(button as HTMLButtonElement);

        await waitFor(() =>
            expect(createMerchantAction).toHaveBeenCalledOnce()
        );

        const formData = createMerchantAction.mock.calls[0]?.[0] as FormData;
        expect(formData.get('name')).toBe('Bufet');
        expect(formData.get('brandName')).toBe('Bufet');
        expect(formData.get('domain')).toBe('bufet.ua');
        expect(formData.get('brandfetchBrandId')).toBe('id_bufet');
        expect(formData.get('logoUrl')).toBe(
            'https://cdn.brandfetch.io/bufet/icon.svg'
        );
        expect(onChange).toHaveBeenCalledWith(selected);
    });
});
