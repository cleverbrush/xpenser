/**
 * @vitest-environment jsdom
 */

import { render, screen } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';
import { AppNav } from './app-nav';

vi.mock('next/navigation', () => ({
    usePathname: () => '/dashboard',
    useSearchParams: () => new URLSearchParams()
}));
vi.mock('@/lib/config', () => ({
    webConfig: { singleUser: { enabled: true } }
}));

function renderNav(feedbackEnabled: boolean) {
    return render(
        <AppNav budgets={[]} feedbackEnabled={feedbackEnabled} timezone="UTC" />
    );
}

describe('AppNav feedback action', () => {
    it('hides feedback triggers when the integration is disabled', () => {
        renderNav(false);

        expect(
            screen.queryByRole('button', { name: 'Leave feedback' })
        ).toBeNull();
    });

    it('renders desktop and mobile feedback triggers when enabled', () => {
        renderNav(true);

        expect(
            screen.getAllByRole('button', { name: 'Leave feedback' })
        ).toHaveLength(2);
    });
});
