/**
 * @vitest-environment jsdom
 */

import { render, screen } from '@testing-library/react';
import { createElement } from 'react';
import { describe, expect, it } from 'vitest';
import { publicSeoPages } from '@/lib/public-site';
import { SeoPage } from './seo-page';

describe('SeoPage', () => {
    it.each(publicSeoPages)('renders %s with crawlable links', page => {
        render(createElement(SeoPage, { page }));

        expect(
            screen.getByRole('heading', { level: 1, name: page.h1 })
        ).toBeTruthy();
        expect(screen.getByText(page.description)).toBeTruthy();
        expect(screen.getByLabelText('Breadcrumb')).toBeTruthy();
        expect(
            screen.getByAltText(/xpenser dashboard month view/i)
        ).toBeTruthy();
        expect(
            screen.getByText(/Create a hosted account for the public xpenser/i)
        ).toBeTruthy();

        for (const section of page.sections) {
            expect(
                screen.getByRole('heading', {
                    level: 3,
                    name: section.title
                })
            ).toBeTruthy();
            expect(screen.getByText(section.body)).toBeTruthy();
        }

        expect(
            screen.getAllByRole('link', { name: /Create account/i }).length
        ).toBeGreaterThan(0);
        expect(
            screen
                .getAllByRole('link', { name: /View source/i })
                .every(
                    link =>
                        link.getAttribute('href') ===
                        'https://github.com/cleverbrush/xpenser'
                )
        ).toBe(true);
        if (page.path === '/personal-finance-api-mcp') {
            expect(
                screen.getByRole('link', { name: /Open API docs/i })
            ).toHaveProperty('href', 'http://localhost:3000/api-docs');
        }
        expect(screen.queryByAltText('Huzzler Embed Badge')).toBeNull();
    });
});
