/**
 * @vitest-environment jsdom
 */

import { render } from '@testing-library/react';
import type { ComponentProps } from 'react';
import { describe, expect, it, vi } from 'vitest';
import { GoogleTagManager } from './google-tag-manager';

vi.mock('next/script', () => ({
    default: ({
        strategy,
        ...props
    }: ComponentProps<'script'> & {
        readonly strategy?: string;
    }) => <script data-strategy={strategy} {...props} />
}));

describe('GoogleTagManager', () => {
    it('initializes the data layer and loads the configured container', () => {
        const { container } = render(<GoogleTagManager gtmId="GTM-WRLXDMG" />);

        const initializer = container.querySelector('#_next-gtm-init');
        const loader = container.querySelector('#_next-gtm');

        expect(initializer?.textContent).toContain("window,'dataLayer'");
        expect(loader?.getAttribute('src')).toBe(
            'https://www.googletagmanager.com/gtm.js?id=GTM-WRLXDMG'
        );
        expect(loader?.getAttribute('data-strategy')).toBe('afterInteractive');
    });
});
