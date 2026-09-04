/**
 * @vitest-environment jsdom
 */

import { fireEvent, render, screen } from '@testing-library/react';
import type { AnchorHTMLAttributes, ReactNode } from 'react';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { AppNavigationLink, AppNavigationPending } from './app-navigation-link';

let linkPending = false;

vi.mock('next/link', () => ({
    default: ({
        children,
        prefetch,
        ...props
    }: AnchorHTMLAttributes<HTMLAnchorElement> & {
        readonly children: ReactNode;
        readonly prefetch?: boolean | null;
    }) => (
        <a data-prefetch={String(prefetch)} {...props}>
            {children}
        </a>
    ),
    useLinkStatus: () => ({ pending: linkPending })
}));

describe('AppNavigationLink', () => {
    beforeEach(() => {
        linkPending = false;
    });

    it('keeps automatic partial prefetch until the user hovers', () => {
        render(
            <AppNavigationLink href="/transactions">
                Transactions
            </AppNavigationLink>
        );

        const link = screen.getByRole('link', { name: 'Transactions' });
        expect(link.getAttribute('data-prefetch')).toBe('null');

        fireEvent.mouseEnter(link);

        expect(link.getAttribute('data-prefetch')).toBe('true');
    });

    it('fully prefetches after keyboard focus', () => {
        render(<AppNavigationLink href="/stats">Reports</AppNavigationLink>);

        const link = screen.getByRole('link', { name: 'Reports' });
        fireEvent.focus(link);

        expect(link.getAttribute('data-prefetch')).toBe('true');
    });

    it('does not carry prefetch intent to a changed destination', () => {
        const view = render(
            <AppNavigationLink href="/dashboard?date=2026-09-01">
                Dashboard
            </AppNavigationLink>
        );
        const link = screen.getByRole('link', { name: 'Dashboard' });
        fireEvent.mouseEnter(link);
        expect(link.getAttribute('data-prefetch')).toBe('true');

        view.rerender(
            <AppNavigationLink href="/dashboard?date=2026-09-02">
                Dashboard
            </AppNavigationLink>
        );

        expect(link.getAttribute('data-prefetch')).toBe('null');
    });

    it('renders a fixed pending indicator while navigation is active', () => {
        linkPending = true;

        render(
            <AppNavigationLink href="/capture">
                Add
                <AppNavigationPending />
            </AppNavigationLink>
        );

        const indicator = screen
            .getByRole('link', { name: 'Add' })
            .querySelector('[data-slot="app-navigation-pending"]');
        expect(indicator?.getAttribute('data-pending')).toBe('true');
        expect(
            indicator?.querySelector('[data-icon="inline-start"]')
        ).not.toBeNull();
    });
});
