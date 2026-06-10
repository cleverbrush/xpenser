import { describe, expect, it } from 'vitest';
import { noIndexRobots } from '@/lib/public-site';
import robots from './robots';
import sitemap from './sitemap';

describe('metadata routes', () => {
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
                    '/external-api/',
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
            'https://xpenser.cleverbrush.com/personal-finance-api-mcp'
        ]);
    });

    it('marks app and auth route groups as noindex', () => {
        expect(noIndexRobots).toEqual({ index: false, follow: true });
    });
});
