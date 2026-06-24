/**
 * @vitest-environment jsdom
 */

import { render, screen } from '@testing-library/react';
import { createElement } from 'react';
import { describe, expect, it } from 'vitest';
import { LandingPage } from './landing-page';

describe('LandingPage', () => {
    it('renders the public landing content and key navigation links', () => {
        render(createElement(LandingPage));

        expect(
            screen.getByRole('heading', {
                level: 1,
                name: /Self-hosted personal finance tracking with xpenser/i
            })
        ).toBeTruthy();
        expect(
            screen.getByText(/Track and analyze income and expenses/i)
        ).toBeTruthy();
        expect(
            screen.getByText(/hosted account is for xpenser\.cleverbrush\.com/i)
        ).toBeTruthy();
        expect(
            screen.getByAltText(/xpenser dashboard month view/i)
        ).toBeTruthy();
        expect(screen.getByAltText(/xpenser transactions table/i)).toBeTruthy();
        expect(
            screen.getByAltText(/API keys and MCP setup instructions/i)
        ).toBeTruthy();
        expect(
            screen.getByText(/API access is a product surface/i)
        ).toBeTruthy();
        expect(
            screen.getByText(/Real screens, not a placeholder finance app/i)
        ).toBeTruthy();
        expect(
            screen.getByText(/Learn Cleverbrush from a working app/i)
        ).toBeTruthy();
        expect(screen.getAllByText(/Telegram bot/i).length).toBeGreaterThan(0);
        expect(screen.getAllByText(/MCP server/i).length).toBeGreaterThan(0);
        expect(screen.getAllByText(/self-host/i).length).toBeGreaterThan(0);
        expect(screen.getAllByText(/open-source/i).length).toBeGreaterThan(0);
        expect(screen.getAllByText(/MIT licensed/i).length).toBeGreaterThan(0);
        expect(
            screen.getAllByText(/Expense tracking workflows/i).length
        ).toBeGreaterThan(0);
        const huzzlerBadgeLink = screen.getByRole('link', {
            name: /Huzzler Embed Badge/i
        });
        expect(huzzlerBadgeLink).toHaveProperty(
            'href',
            'https://huzzler.so/products/muk1OItiEN/xpenser?utm_source=huzzler_product_website&utm_medium=badge&utm_campaign=free_listing'
        );
        expect(huzzlerBadgeLink.getAttribute('target')).toBe('_blank');
        expect(huzzlerBadgeLink.getAttribute('rel')).toBe(
            'noopener noreferrer'
        );

        const huzzlerBadgeImage = screen.getByAltText('Huzzler Embed Badge');
        expect(huzzlerBadgeImage.getAttribute('src')).toBe(
            'https://huzzler.so/assets/images/embeddable-badges/featured.png'
        );
        expect(huzzlerBadgeImage.getAttribute('width')).toBe('159');
        expect(huzzlerBadgeImage.getAttribute('height')).toBe('55');

        const tinyStartupsBadgeLink = screen.getByRole('link', {
            name: /Launched on Tiny Startups/i
        });
        expect(tinyStartupsBadgeLink).toHaveProperty(
            'href',
            'https://www.tinystartups.com/startup/xpenser'
        );
        expect(tinyStartupsBadgeLink.getAttribute('target')).toBe('_blank');
        expect(tinyStartupsBadgeLink.getAttribute('rel')).toBe(
            'noopener noreferrer'
        );

        const easyDoFollowBadgeLink = screen.getByRole('link', {
            name: /Featured on EasyDoFollow/i
        });
        expect(easyDoFollowBadgeLink).toHaveProperty(
            'href',
            'http://easydofollow.dev/finance/xpenser'
        );
        expect(easyDoFollowBadgeLink.getAttribute('target')).toBe('_blank');
        expect(easyDoFollowBadgeLink.getAttribute('rel')).toBe(
            'noopener noreferrer'
        );

        const easyDoFollowBadgeImages = screen.getAllByAltText(
            'Featured on EasyDoFollow'
        );
        expect(easyDoFollowBadgeImages).toHaveLength(2);

        const easyDoFollowLightBadgeImage = easyDoFollowBadgeImages.find(
            image =>
                image.getAttribute('src') ===
                'http://easydofollow.dev/badge/easydofollow-badge-light.svg'
        );
        expect(easyDoFollowLightBadgeImage).toBeTruthy();
        expect(easyDoFollowLightBadgeImage?.getAttribute('width')).toBe('188');
        expect(easyDoFollowLightBadgeImage?.getAttribute('height')).toBe('56');
        expect(easyDoFollowLightBadgeImage?.className).toContain('block');
        expect(easyDoFollowLightBadgeImage?.className).toContain('dark:hidden');

        const easyDoFollowDarkBadgeImage = easyDoFollowBadgeImages.find(
            image =>
                image.getAttribute('src') ===
                'http://easydofollow.dev/badge/easydofollow-badge-dark.svg'
        );
        expect(easyDoFollowDarkBadgeImage).toBeTruthy();
        expect(easyDoFollowDarkBadgeImage?.getAttribute('width')).toBe('188');
        expect(easyDoFollowDarkBadgeImage?.getAttribute('height')).toBe('56');
        expect(easyDoFollowDarkBadgeImage?.className).toContain('hidden');
        expect(easyDoFollowDarkBadgeImage?.className).toContain('dark:block');

        const scrollLaunchBadgeLink = screen.getByRole('link', {
            name: /Featured on ScrollLaunch/i
        });
        expect(scrollLaunchBadgeLink).toHaveProperty(
            'href',
            'https://www.scrolllaunch.com/products/xpenser?utm_source=badge&utm_medium=embed&utm_campaign=xpenser&ref=scrolllaunch'
        );
        expect(scrollLaunchBadgeLink.getAttribute('target')).toBe('_blank');
        expect(scrollLaunchBadgeLink.getAttribute('rel')).toBe(
            'noopener noreferrer'
        );

        const scrollLaunchBadgeImage = screen.getByAltText(
            'Featured on ScrollLaunch'
        );
        expect(scrollLaunchBadgeImage.getAttribute('src')).toBe(
            'https://www.scrolllaunch.com/api/badge/xpenser'
        );
        expect(scrollLaunchBadgeImage.getAttribute('width')).toBe('220');
        expect(scrollLaunchBadgeImage.getAttribute('height')).toBe('48');
        expect(scrollLaunchBadgeImage.getAttribute('loading')).toBe('lazy');
        expect(
            screen.getByText(
                /read or manage vendors, categories, and transactions/i
            )
        ).toBeTruthy();
        expect(
            screen.getAllByText(/multiple currencies/i).length
        ).toBeGreaterThan(0);
        expect(screen.getAllByText(/Frankfurter/i).length).toBeGreaterThan(0);
        expect(
            screen.getAllByText(/weekly and monthly email summaries/i).length
        ).toBeGreaterThan(0);
        expect(
            screen.getByRole('link', {
                name: /Self-hosted personal finance tracker/i
            })
        ).toHaveProperty(
            'href',
            'http://localhost:3000/self-hosted-personal-finance-tracker'
        );
        expect(
            screen.getByRole('link', { name: /Open-source expense tracker/i })
        ).toHaveProperty(
            'href',
            'http://localhost:3000/open-source-expense-tracker'
        );
        expect(
            screen.getByRole('link', {
                name: /Personal finance API and MCP access/i
            })
        ).toHaveProperty(
            'href',
            'http://localhost:3000/personal-finance-api-mcp'
        );
        expect(
            screen.getAllByRole('link', { name: /^API docs$/i }).length
        ).toBeGreaterThan(0);
        expect(
            screen.getByRole('link', { name: /OpenAPI JSON/i })
        ).toHaveProperty(
            'href',
            'http://localhost:3000/external-api/openapi.json'
        );
        expect(
            screen.getAllByText(/external-api\/mcp/i).length
        ).toBeGreaterThan(0);

        const signInLinks = screen.getAllByRole('link', { name: /sign in/i });
        expect(
            signInLinks.some(link => link.getAttribute('href') === '/login')
        ).toBe(true);

        const registerLinks = screen.getAllByRole('link', {
            name: /create account/i
        });
        expect(
            registerLinks.some(
                link => link.getAttribute('href') === '/register'
            )
        ).toBe(true);

        const xpenserGithubLinks = screen.getAllByRole('link', {
            name: /xpenser github/i
        });
        expect(
            xpenserGithubLinks.every(
                link =>
                    link.getAttribute('href') ===
                    'https://github.com/cleverbrush/xpenser'
            )
        ).toBe(true);

        const frameworkGithubLinks = screen.getAllByRole('link', {
            name: /framework github/i
        });
        expect(
            frameworkGithubLinks.every(
                link =>
                    link.getAttribute('href') ===
                    'https://github.com/cleverbrush/framework'
            )
        ).toBe(true);

        const docsLinks = screen.getAllByRole('link', {
            name: /cleverbrush docs/i
        });
        expect(
            docsLinks.every(
                link =>
                    link.getAttribute('href') === 'https://docs.cleverbrush.com'
            )
        ).toBe(true);

        const schemaLinks = screen.getAllByRole('link', {
            name: /schema docs/i
        });
        expect(
            schemaLinks.every(
                link =>
                    link.getAttribute('href') ===
                    'https://schema.cleverbrush.com'
            )
        ).toBe(true);
    });
});
