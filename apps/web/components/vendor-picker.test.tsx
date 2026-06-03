/**
 * @vitest-environment jsdom
 */

import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import type { Vendor } from '@xpenser/contracts';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { VendorPicker } from './vendor-picker';

const createVendorAction = vi.fn();
const searchVendorCandidatesAction = vi.fn();

vi.mock('@/lib/actions', () => ({
    createVendorAction: (formData: FormData) => createVendorAction(formData),
    searchVendorCandidatesAction: (query: string) =>
        searchVendorCandidatesAction(query)
}));

const timestamp = new Date('2026-06-01T00:00:00.000Z');

function vendor(overrides: Partial<Vendor> = {}): Vendor {
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

describe('VendorPicker', () => {
    afterEach(() => {
        createVendorAction.mockReset();
        searchVendorCandidatesAction.mockReset();
    });

    it('creates a vendor from a Brandfetch search suggestion', async () => {
        const selected = vendor({
            id: 9,
            resolvedName: 'Bufet',
            domain: 'bufet.ua',
            logoUrl: 'https://cdn.brandfetch.io/bufet/icon.svg'
        });
        createVendorAction.mockResolvedValue(selected);
        searchVendorCandidatesAction.mockResolvedValue([
            {
                brandfetchBrandId: 'id_bufet',
                name: 'Bufet',
                domain: 'bufet.ua',
                logoUrl: 'https://cdn.brandfetch.io/bufet/icon.svg',
                claimed: true
            }
        ]);
        const onChange = vi.fn();

        render(
            <VendorPicker
                vendors={[]}
                onChange={onChange}
                selectedVendorId={null}
            />
        );

        const input = screen.getByLabelText('Vendor');
        fireEvent.focus(input);
        fireEvent.change(input, {
            target: { value: 'Bufet' }
        });

        await waitFor(() =>
            expect(searchVendorCandidatesAction).toHaveBeenCalledWith('Bufet')
        );
        const domain = await screen.findByText('bufet.ua');
        const button = domain.closest('button');
        expect(button).toBeTruthy();

        fireEvent.click(button as HTMLButtonElement);

        await waitFor(() => expect(createVendorAction).toHaveBeenCalledOnce());

        const formData = createVendorAction.mock.calls[0]?.[0] as FormData;
        expect(formData.get('name')).toBe('Bufet');
        expect(formData.get('resolvedName')).toBe('Bufet');
        expect(formData.get('domain')).toBe('bufet.ua');
        expect(formData.get('brandfetchBrandId')).toBe('id_bufet');
        expect(formData.get('logoUrl')).toBe(
            'https://cdn.brandfetch.io/bufet/icon.svg'
        );
        expect(onChange).toHaveBeenCalledWith(selected);
    });

    it('shows local suggestions only after the vendor input is focused', () => {
        const onChange = vi.fn();

        render(
            <VendorPicker
                vendors={[vendor()]}
                onChange={onChange}
                selectedVendorId={null}
            />
        );

        expect(screen.queryByRole('button', { name: /Bufet/ })).toBeNull();

        fireEvent.focus(screen.getByLabelText('Vendor'));

        expect(screen.getByRole('button', { name: /Bufet/ })).toBeTruthy();
    });

    it('does not search Brandfetch for an exact local vendor match', async () => {
        const onChange = vi.fn();

        render(
            <VendorPicker
                vendors={[vendor({ domain: 'bufet.ua' })]}
                onChange={onChange}
                selectedVendorId={null}
            />
        );

        const input = screen.getByLabelText('Vendor');
        fireEvent.focus(input);
        fireEvent.change(input, {
            target: { value: 'Bufet' }
        });
        await new Promise(resolve => setTimeout(resolve, 350));

        expect(searchVendorCandidatesAction).not.toHaveBeenCalled();
    });

    it('hides search while a vendor is selected until cleared', () => {
        const selected = vendor({
            id: 9,
            name: 'Walmart',
            displayName: 'Walmart',
            domain: 'walmart.com'
        });
        const onChange = vi.fn();

        render(
            <VendorPicker
                vendors={[selected]}
                onChange={onChange}
                selectedVendorId={selected.id}
            />
        );

        expect(screen.getByText('Walmart')).toBeTruthy();
        expect(screen.getByText('walmart.com')).toBeTruthy();
        expect(screen.queryByLabelText('Vendor')).toBeNull();

        fireEvent.click(screen.getByRole('button', { name: 'Clear' }));

        expect(onChange).toHaveBeenCalledWith(undefined);
    });
});
