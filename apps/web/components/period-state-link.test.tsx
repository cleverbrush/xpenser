/**
 * @vitest-environment jsdom
 */

import { render, screen } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { PeriodStateLink } from './period-state-link';

let pathname = '/dashboard';
let searchParams = new URLSearchParams();

vi.mock('next/navigation', () => ({
    usePathname: () => pathname,
    useSearchParams: () => searchParams
}));

function renderLink(href: string) {
    render(<PeriodStateLink href={href}>Destination</PeriodStateLink>);
    return screen.getByRole('link', { name: 'Destination' });
}

describe('PeriodStateLink', () => {
    beforeEach(() => {
        pathname = '/dashboard';
        searchParams = new URLSearchParams();
    });

    it('preserves period and date when leaving reports for dashboard', () => {
        pathname = '/stats';
        searchParams = new URLSearchParams({
            date: '2026-05-01',
            period: 'month',
            tag: '3',
            view: 'tags'
        });

        expect(renderLink('/dashboard').getAttribute('href')).toBe(
            '/dashboard?period=month&date=2026-05-01'
        );
    });

    it('preserves period and date when leaving reports for vendors', () => {
        pathname = '/stats';
        searchParams = new URLSearchParams({
            date: '2026-05-11',
            period: 'week',
            view: 'categories'
        });

        expect(renderLink('/vendors').getAttribute('href')).toBe(
            '/vendors?period=week&date=2026-05-11'
        );
    });

    it('preserves period and date when opening reports from dashboard', () => {
        pathname = '/dashboard';
        searchParams = new URLSearchParams({
            date: '2026-05-11',
            period: 'week'
        });

        expect(renderLink('/stats').getAttribute('href')).toBe(
            '/stats?period=week&date=2026-05-11'
        );
    });

    it('preserves currency between dashboard and vendors views', () => {
        pathname = '/dashboard';
        searchParams = new URLSearchParams({
            currency: 'EUR',
            date: '2026-05-11',
            period: 'week'
        });

        expect(renderLink('/vendors').getAttribute('href')).toBe(
            '/vendors?period=week&date=2026-05-11&currency=EUR'
        );
    });

    it('does not preserve dashboard currency when opening reports', () => {
        pathname = '/dashboard';
        searchParams = new URLSearchParams({
            currency: 'EUR',
            date: '2026-05-11',
            period: 'week'
        });

        expect(renderLink('/stats').getAttribute('href')).toBe(
            '/stats?period=week&date=2026-05-11'
        );
    });

    it('does not preserve period state from unrelated pages', () => {
        pathname = '/transactions';
        searchParams = new URLSearchParams({
            date: '2026-05-11',
            period: 'week'
        });

        expect(renderLink('/stats').getAttribute('href')).toBe('/stats');
    });
});
