/**
 * @vitest-environment jsdom
 */

import { render } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';
import { Toaster } from './sonner.js';

const { renderSonner } = vi.hoisted(() => ({
    renderSonner: vi.fn()
}));

vi.mock('next-themes', () => ({
    useTheme: () => ({ theme: 'dark' })
}));

vi.mock('sonner', () => ({
    Toaster: (props: unknown) => {
        renderSonner(props);
        return null;
    },
    toast: {}
}));

describe('Toaster', () => {
    it('uses project-wide defaults and the active theme', () => {
        render(<Toaster />);

        expect(renderSonner.mock.calls[0]?.[0]).toEqual(
            expect.objectContaining({
                duration: 4_000,
                position: 'bottom-right',
                style: expect.objectContaining({
                    '--normal-bg': 'hsl(var(--popover))',
                    '--normal-border': 'hsl(var(--border))',
                    '--normal-text': 'hsl(var(--popover-foreground))'
                }),
                theme: 'dark'
            })
        );
    });
});
