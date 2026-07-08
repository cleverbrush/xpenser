/**
 * @vitest-environment jsdom
 */

import { render, screen, within } from '@testing-library/react';
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
            screen.getByText(/Accounts are for xpenser\.cleverbrush\.com/i)
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

        const auraPlusPlusBadgeLink = screen.getByRole('link', {
            name: /Featured on Aura\+\+/i
        });
        expect(auraPlusPlusBadgeLink).toHaveProperty(
            'href',
            'https://auraplusplus.com/projects/xpenser-self-hosted-personal-finance-tracker'
        );
        expect(auraPlusPlusBadgeLink.getAttribute('target')).toBe('_blank');
        expect(auraPlusPlusBadgeLink.getAttribute('rel')).toBe(
            'noopener noreferrer'
        );

        const auraPlusPlusBadgeImages =
            screen.getAllByAltText('Featured on Aura++');
        expect(auraPlusPlusBadgeImages).toHaveLength(2);

        const auraPlusPlusLightBadgeImage = auraPlusPlusBadgeImages.find(
            image =>
                image.getAttribute('src') ===
                'https://auraplusplus.com/images/badges/featured-on-light.svg'
        );
        expect(auraPlusPlusLightBadgeImage).toBeTruthy();
        expect(auraPlusPlusLightBadgeImage?.getAttribute('width')).toBe('265');
        expect(auraPlusPlusLightBadgeImage?.getAttribute('height')).toBe('58');
        expect(auraPlusPlusLightBadgeImage?.className).toContain('block');
        expect(auraPlusPlusLightBadgeImage?.className).toContain('dark:hidden');

        const auraPlusPlusDarkBadgeImage = auraPlusPlusBadgeImages.find(
            image =>
                image.getAttribute('src') ===
                'https://auraplusplus.com/images/badges/featured-on-dark.svg'
        );
        expect(auraPlusPlusDarkBadgeImage).toBeTruthy();
        expect(auraPlusPlusDarkBadgeImage?.getAttribute('width')).toBe('265');
        expect(auraPlusPlusDarkBadgeImage?.getAttribute('height')).toBe('58');
        expect(auraPlusPlusDarkBadgeImage?.className).toContain('hidden');
        expect(auraPlusPlusDarkBadgeImage?.className).toContain('dark:block');

        const toolfioBadgeLink = screen.getByRole('link', {
            name: /Featured on Toolfio/i
        });
        expect(toolfioBadgeLink).toHaveProperty('href', 'https://toolfio.com/');
        expect(toolfioBadgeLink.getAttribute('target')).toBe('_blank');
        expect(toolfioBadgeLink.getAttribute('rel')).toBe(
            'dofollow noopener noreferrer'
        );

        const toolfioBadgeImages = screen.getAllByAltText(
            'Featured on Toolfio'
        );
        expect(toolfioBadgeImages).toHaveLength(2);

        const toolfioLightBadgeImage = toolfioBadgeImages.find(
            image =>
                image.getAttribute('src') ===
                'https://toolfio.com/toolfio-light-badge.png'
        );
        expect(toolfioLightBadgeImage).toBeTruthy();
        expect(toolfioLightBadgeImage?.getAttribute('width')).toBe('200');
        expect(toolfioLightBadgeImage?.getAttribute('height')).toBe('54');
        expect(toolfioLightBadgeImage?.className).toContain('block');
        expect(toolfioLightBadgeImage?.className).toContain('dark:hidden');

        const toolfioDarkBadgeImage = toolfioBadgeImages.find(
            image =>
                image.getAttribute('src') ===
                'https://toolfio.com/toolfio-dark-badge.png'
        );
        expect(toolfioDarkBadgeImage).toBeTruthy();
        expect(toolfioDarkBadgeImage?.getAttribute('width')).toBe('200');
        expect(toolfioDarkBadgeImage?.getAttribute('height')).toBe('54');
        expect(toolfioDarkBadgeImage?.className).toContain('hidden');
        expect(toolfioDarkBadgeImage?.className).toContain('dark:block');

        const openHuntsBadgeLink = screen.getByRole('link', {
            name: /OpenHunts Club Member/i
        });
        expect(openHuntsBadgeLink).toHaveProperty(
            'href',
            'https://openhunts.com/'
        );
        expect(openHuntsBadgeLink.getAttribute('target')).toBe('_blank');
        expect(openHuntsBadgeLink.getAttribute('rel')).toBe(
            'noopener noreferrer'
        );
        expect(openHuntsBadgeLink.getAttribute('title')).toBe('OpenHunts Club');

        const openHuntsBadgeImage = screen.getByAltText(
            'OpenHunts Club Member'
        );
        expect(openHuntsBadgeImage.getAttribute('src')).toBe(
            'https://cdn.openhunts.com/badges/club.webp'
        );
        expect(openHuntsBadgeImage.getAttribute('width')).toBe('486');
        expect(openHuntsBadgeImage.getAttribute('height')).toBe('105');
        expect(openHuntsBadgeImage.getAttribute('style')).toBe(
            'height: auto; width: 195px;'
        );
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
            screen.getByRole('link', { name: /^Alternatives$/i })
        ).toHaveProperty('href', 'http://localhost:3000/alternatives');
        expect(
            screen.getByRole('link', { name: /OpenAPI JSON/i })
        ).toHaveProperty('href', 'http://localhost:3000/api/openapi.json');
        expect(screen.getAllByText(/api\/mcp/i).length).toBeGreaterThan(0);

        const heroSection = screen
            .getByRole('heading', {
                level: 1,
                name: /Self-hosted personal finance tracking with xpenser/i
            })
            .closest('section');
        expect(heroSection).toBeTruthy();
        expect(
            within(heroSection as HTMLElement).getByRole('link', {
                name: /^Sign in$/i
            })
        ).toHaveProperty('href', 'http://localhost:3000/login');
        expect(
            within(heroSection as HTMLElement).getByRole('link', {
                name: /Create account/i
            })
        ).toHaveProperty('href', 'http://localhost:3000/register');

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
