import { afterEach, describe, expect, it, vi } from 'vitest';
import { noIndexRobots } from '@/lib/public-site';
import robots from './robots';
import sitemap from './sitemap';

describe('metadata routes', () => {
    afterEach(() => {
        vi.unstubAllEnvs();
        vi.resetModules();
    });

    it('serves robots rules with the public sitemap', () => {
        const robotsFile = robots();

        expect(robotsFile.sitemap).toBe(
            'https://xpenser.cleverbrush.com/sitemap.xml'
        );
        expect(robotsFile.rules).toEqual(
            expect.objectContaining({
                userAgent: '*',
                allow: '/',
                disallow: expect.arrayContaining([
                    '/api/',
                    '/app-api/',
                    '/authjs/',
                    '/dashboard'
                ])
            })
        );
    });

    it('serves only public sitemap URLs', () => {
        expect(sitemap().map(entry => entry.url)).toEqual([
            'https://xpenser.cleverbrush.com/',
            'https://xpenser.cleverbrush.com/self-hosted-personal-finance-tracker',
            'https://xpenser.cleverbrush.com/open-source-expense-tracker',
            'https://xpenser.cleverbrush.com/personal-finance-api-mcp',
            'https://xpenser.cleverbrush.com/api-docs'
        ]);
    });

    it('marks app and auth route groups as noindex', () => {
        expect(noIndexRobots).toEqual({ index: false, follow: true });
    });

    it('hides public sitemap metadata in single-user mode', async () => {
        vi.stubEnv('XPENSER_SINGLE_USER_MODE', '1');
        vi.stubEnv('XPENSER_SINGLE_USER_EMAIL', 'owner@example.com');
        vi.resetModules();

        const [{ default: singleUserRobots }, { default: singleUserSitemap }] =
            await Promise.all([import('./robots'), import('./sitemap')]);

        expect(singleUserRobots()).toEqual({
            rules: {
                userAgent: '*',
                disallow: '/'
            }
        });
        expect(singleUserSitemap()).toEqual([]);
    });
});
