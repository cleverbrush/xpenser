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

        const earlyHuntBadgeLink = screen.getByRole('link', {
            name: /Featured on EarlyHunt/i
        });
        expect(earlyHuntBadgeLink).toHaveProperty(
            'href',
            'https://earlyhunt.com/project/xpenser'
        );
        expect(earlyHuntBadgeLink.getAttribute('target')).toBe('_blank');
        expect(earlyHuntBadgeLink.getAttribute('rel')).toBe(
            'noopener noreferrer'
        );

        const earlyHuntBadgeImages = screen.getAllByAltText(
            'Featured on EarlyHunt'
        );
        expect(earlyHuntBadgeImages).toHaveLength(2);

        const earlyHuntLightBadgeImage = earlyHuntBadgeImages.find(
            image =>
                image.getAttribute('src') ===
                'https://earlyhunt.com/badges/earlyhunt-badge-light.svg'
        );
        expect(earlyHuntLightBadgeImage).toBeTruthy();
        expect(earlyHuntLightBadgeImage?.getAttribute('width')).toBe('265');
        expect(earlyHuntLightBadgeImage?.getAttribute('height')).toBe('58');
        expect(earlyHuntLightBadgeImage?.className).toContain('block');
        expect(earlyHuntLightBadgeImage?.className).toContain('dark:hidden');

        const earlyHuntDarkBadgeImage = earlyHuntBadgeImages.find(
            image =>
                image.getAttribute('src') ===
                'https://earlyhunt.com/badges/earlyhunt-badge-dark.svg'
        );
        expect(earlyHuntDarkBadgeImage).toBeTruthy();
        expect(earlyHuntDarkBadgeImage?.getAttribute('width')).toBe('265');
        expect(earlyHuntDarkBadgeImage?.getAttribute('height')).toBe('58');
        expect(earlyHuntDarkBadgeImage?.className).toContain('hidden');
        expect(earlyHuntDarkBadgeImage?.className).toContain('dark:block');

        const dangBadgeLink = screen.getByRole('link', {
            name: /Verified on DANG!/i
        });
        expect(dangBadgeLink).toHaveProperty('href', 'https://dang.ai/');
        expect(dangBadgeLink.getAttribute('target')).toBe('_blank');
        expect(dangBadgeLink.getAttribute('rel')).toBe(
            'dofollow noopener noreferrer'
        );

        const dangBadgeImages = screen.getAllByAltText('Verified on DANG!');
        expect(dangBadgeImages).toHaveLength(2);

        const dangLightBadgeImage = dangBadgeImages.find(
            image =>
                image.getAttribute('src') ===
                'https://assets.dang.ai/badges/dang-verified-light.png'
        );
        expect(dangLightBadgeImage).toBeTruthy();
        expect(dangLightBadgeImage?.getAttribute('width')).toBe('260');
        expect(dangLightBadgeImage?.getAttribute('height')).toBe('94');
        expect(dangLightBadgeImage?.className).toContain('block');
        expect(dangLightBadgeImage?.className).toContain('dark:hidden');

        const dangDarkBadgeImage = dangBadgeImages.find(
            image =>
                image.getAttribute('src') ===
                'https://assets.dang.ai/badges/dang-verified-dark.png'
        );
        expect(dangDarkBadgeImage).toBeTruthy();
        expect(dangDarkBadgeImage?.getAttribute('width')).toBe('260');
        expect(dangDarkBadgeImage?.getAttribute('height')).toBe('94');
        expect(dangDarkBadgeImage?.className).toContain('hidden');
        expect(dangDarkBadgeImage?.className).toContain('dark:block');

        const twelveToolsBadgeLink = screen.getByRole('link', {
            name: /Featured on Twelve Tools/i
        });
        expect(twelveToolsBadgeLink).toHaveProperty(
            'href',
            'https://twelve.tools/'
        );
        expect(twelveToolsBadgeLink.getAttribute('target')).toBe('_blank');
        expect(twelveToolsBadgeLink.getAttribute('rel')).toBe(
            'noopener noreferrer'
        );

        const twelveToolsBadgeImages = screen.getAllByAltText(
            'Featured on Twelve Tools'
        );
        expect(twelveToolsBadgeImages).toHaveLength(2);

        const twelveToolsLightBadgeImage = twelveToolsBadgeImages.find(
            image =>
                image.getAttribute('src') ===
                'https://twelve.tools/badge0-white.svg'
        );
        expect(twelveToolsLightBadgeImage).toBeTruthy();
        expect(twelveToolsLightBadgeImage?.getAttribute('width')).toBe('200');
        expect(twelveToolsLightBadgeImage?.getAttribute('height')).toBe('54');
        expect(twelveToolsLightBadgeImage?.className).toContain('block');
        expect(twelveToolsLightBadgeImage?.className).toContain('dark:hidden');

        const twelveToolsDarkBadgeImage = twelveToolsBadgeImages.find(
            image =>
                image.getAttribute('src') ===
                'https://twelve.tools/badge0-dark.svg'
        );
        expect(twelveToolsDarkBadgeImage).toBeTruthy();
        expect(twelveToolsDarkBadgeImage?.getAttribute('width')).toBe('200');
        expect(twelveToolsDarkBadgeImage?.getAttribute('height')).toBe('54');
        expect(twelveToolsDarkBadgeImage?.className).toContain('hidden');
        expect(twelveToolsDarkBadgeImage?.className).toContain('dark:block');

        const wiredBusinessBadgeLink = screen.getByRole('link', {
            name: /Featured on Wired Business/i
        });
        expect(wiredBusinessBadgeLink).toHaveProperty(
            'href',
            'https://wired.business/'
        );
        expect(wiredBusinessBadgeLink.getAttribute('target')).toBe('_blank');
        expect(wiredBusinessBadgeLink.getAttribute('rel')).toBe(
            'noopener noreferrer'
        );

        const wiredBusinessBadgeImages = screen.getAllByAltText(
            'Featured on Wired Business'
        );
        expect(wiredBusinessBadgeImages).toHaveLength(2);

        const wiredBusinessLightBadgeImage = wiredBusinessBadgeImages.find(
            image =>
                image.getAttribute('src') ===
                'https://wired.business/badge0-white.svg'
        );
        expect(wiredBusinessLightBadgeImage).toBeTruthy();
        expect(wiredBusinessLightBadgeImage?.getAttribute('width')).toBe('200');
        expect(wiredBusinessLightBadgeImage?.getAttribute('height')).toBe('54');
        expect(wiredBusinessLightBadgeImage?.className).toContain('block');
        expect(wiredBusinessLightBadgeImage?.className).toContain(
            'dark:hidden'
        );

        const wiredBusinessDarkBadgeImage = wiredBusinessBadgeImages.find(
            image =>
                image.getAttribute('src') ===
                'https://wired.business/badge0-dark.svg'
        );
        expect(wiredBusinessDarkBadgeImage).toBeTruthy();
        expect(wiredBusinessDarkBadgeImage?.getAttribute('width')).toBe('200');
        expect(wiredBusinessDarkBadgeImage?.getAttribute('height')).toBe('54');
        expect(wiredBusinessDarkBadgeImage?.className).toContain('hidden');
        expect(wiredBusinessDarkBadgeImage?.className).toContain('dark:block');

        const findlyToolsBadgeLink = screen.getByRole('link', {
            name: /Featured on Findly\.tools/i
        });
        expect(findlyToolsBadgeLink).toHaveProperty(
            'href',
            'https://findly.tools/xpenser?utm_source=xpenser'
        );
        expect(findlyToolsBadgeLink.getAttribute('target')).toBe('_blank');
        expect(findlyToolsBadgeLink.getAttribute('rel')).toBe(
            'noopener noreferrer'
        );

        const findlyToolsBadgeImages = screen.getAllByAltText(
            'Featured on Findly.tools'
        );
        expect(findlyToolsBadgeImages).toHaveLength(2);

        const findlyToolsLightBadgeImage = findlyToolsBadgeImages.find(
            image =>
                image.getAttribute('src') ===
                'https://findly.tools/badges/findly-tools-badge-light.svg'
        );
        expect(findlyToolsLightBadgeImage).toBeTruthy();
        expect(findlyToolsLightBadgeImage?.getAttribute('width')).toBe('175');
        expect(findlyToolsLightBadgeImage?.getAttribute('height')).toBe('55');
        expect(findlyToolsLightBadgeImage?.className).toContain('block');
        expect(findlyToolsLightBadgeImage?.className).toContain('dark:hidden');

        const findlyToolsDarkBadgeImage = findlyToolsBadgeImages.find(
            image =>
                image.getAttribute('src') ===
                'https://findly.tools/badges/findly-tools-badge-dark.svg'
        );
        expect(findlyToolsDarkBadgeImage).toBeTruthy();
        expect(findlyToolsDarkBadgeImage?.getAttribute('width')).toBe('175');
        expect(findlyToolsDarkBadgeImage?.getAttribute('height')).toBe('55');
        expect(findlyToolsDarkBadgeImage?.className).toContain('hidden');
        expect(findlyToolsDarkBadgeImage?.className).toContain('dark:block');

        const neeedDirectoryBadgeLink = screen.getByRole('link', {
            name: /Featured on neeed\.directory/i
        });
        expect(neeedDirectoryBadgeLink).toHaveProperty(
            'href',
            'https://neeed.directory/products/xpenser?utm_source=xpenser'
        );
        expect(neeedDirectoryBadgeLink.getAttribute('target')).toBe('_blank');
        expect(neeedDirectoryBadgeLink.getAttribute('rel')).toBe(
            'noopener noreferrer'
        );

        const neeedDirectoryBadgeImages = screen.getAllByAltText(
            'Featured on neeed.directory'
        );
        expect(neeedDirectoryBadgeImages).toHaveLength(2);

        const neeedDirectoryLightBadgeImage = neeedDirectoryBadgeImages.find(
            image =>
                image.getAttribute('src') ===
                'https://neeed.directory/badges/neeed-badge-light.svg'
        );
        expect(neeedDirectoryLightBadgeImage).toBeTruthy();
        expect(neeedDirectoryLightBadgeImage?.getAttribute('width')).toBe(
            '139'
        );
        expect(neeedDirectoryLightBadgeImage?.getAttribute('height')).toBe(
            '44'
        );
        expect(neeedDirectoryLightBadgeImage?.className).toContain('block');
        expect(neeedDirectoryLightBadgeImage?.className).toContain(
            'dark:hidden'
        );

        const neeedDirectoryDarkBadgeImage = neeedDirectoryBadgeImages.find(
            image =>
                image.getAttribute('src') ===
                'https://neeed.directory/badges/neeed-badge-dark.svg'
        );
        expect(neeedDirectoryDarkBadgeImage).toBeTruthy();
        expect(neeedDirectoryDarkBadgeImage?.getAttribute('width')).toBe('139');
        expect(neeedDirectoryDarkBadgeImage?.getAttribute('height')).toBe('44');
        expect(neeedDirectoryDarkBadgeImage?.className).toContain('hidden');
        expect(neeedDirectoryDarkBadgeImage?.className).toContain('dark:block');

        const foundrListBadgeLink = screen.getByRole('link', {
            name: /Featured on FoundrList/i
        });
        expect(foundrListBadgeLink).toHaveProperty(
            'href',
            'https://www.foundrlist.com/product/xpenser?utm_source=badge&utm_medium=embed'
        );
        expect(foundrListBadgeLink.getAttribute('target')).toBe('_blank');
        expect(foundrListBadgeLink.getAttribute('rel')).toBe('noopener');

        const foundrListBadgeImage = screen.getByAltText(
            'Featured on FoundrList'
        );
        expect(foundrListBadgeImage.getAttribute('src')).toBe(
            'https://www.foundrlist.com/api/badge/xpenser'
        );
        expect(foundrListBadgeImage.getAttribute('width')).toBe('150');
        expect(foundrListBadgeImage.getAttribute('height')).toBe('48');

        const acidToolsBadgeLink = screen.getByRole('link', {
            name: /Acid Tools/i
        });
        expect(acidToolsBadgeLink).toHaveProperty(
            'href',
            'https://acidtools.com/ai/xpenser-cleverbrush'
        );
        expect(acidToolsBadgeLink.getAttribute('target')).toBe('_blank');
        expect(acidToolsBadgeLink.getAttribute('rel')).toBe(
            'noopener noreferrer'
        );

        const acidToolsBadgeImages = screen.getAllByAltText('Acid Tools');
        expect(acidToolsBadgeImages).toHaveLength(2);

        const acidToolsLightBadgeImage = acidToolsBadgeImages.find(
            image =>
                image.getAttribute('src') ===
                'https://acidtools.com/assets/images/badge.png'
        );
        expect(acidToolsLightBadgeImage).toBeTruthy();
        expect(acidToolsLightBadgeImage?.getAttribute('width')).toBeNull();
        expect(acidToolsLightBadgeImage?.getAttribute('height')).toBe('54');
        expect(acidToolsLightBadgeImage?.getAttribute('loading')).toBe('lazy');
        expect(acidToolsLightBadgeImage?.className).toContain('block');
        expect(acidToolsLightBadgeImage?.className).toContain('dark:hidden');

        const acidToolsDarkBadgeImage = acidToolsBadgeImages.find(
            image =>
                image.getAttribute('src') ===
                'https://acidtools.com/assets/images/badge-dark.png'
        );
        expect(acidToolsDarkBadgeImage).toBeTruthy();
        expect(acidToolsDarkBadgeImage?.getAttribute('width')).toBeNull();
        expect(acidToolsDarkBadgeImage?.getAttribute('height')).toBe('54');
        expect(acidToolsDarkBadgeImage?.getAttribute('loading')).toBe('lazy');
        expect(acidToolsDarkBadgeImage?.className).toContain('hidden');
        expect(acidToolsDarkBadgeImage?.className).toContain('dark:block');

        const smolLaunchBadgeLink = screen.getByRole('link', {
            name: /xpenser — Featured on Smol Launch/i
        });
        expect(smolLaunchBadgeLink).toHaveProperty(
            'href',
            'https://smollaunch.com/'
        );
        expect(smolLaunchBadgeLink.getAttribute('target')).toBe('_blank');
        expect(smolLaunchBadgeLink.getAttribute('rel')).toBe('noopener');

        const smolLaunchBadgeImages = screen.getAllByAltText(
            'xpenser — Featured on Smol Launch'
        );
        expect(smolLaunchBadgeImages).toHaveLength(2);

        const smolLaunchLightBadgeImage = smolLaunchBadgeImages.find(
            image =>
                image.getAttribute('src') ===
                'https://smollaunch.com/badges/featured.svg'
        );
        expect(smolLaunchLightBadgeImage).toBeTruthy();
        expect(smolLaunchLightBadgeImage?.getAttribute('width')).toBe('250');
        expect(smolLaunchLightBadgeImage?.getAttribute('height')).toBe('60');
        expect(smolLaunchLightBadgeImage?.getAttribute('loading')).toBe('lazy');
        expect(smolLaunchLightBadgeImage?.className).toContain('block');
        expect(smolLaunchLightBadgeImage?.className).toContain('dark:hidden');

        const smolLaunchDarkBadgeImage = smolLaunchBadgeImages.find(
            image =>
                image.getAttribute('src') ===
                'https://smollaunch.com/badges/featured-dark.svg'
        );
        expect(smolLaunchDarkBadgeImage).toBeTruthy();
        expect(smolLaunchDarkBadgeImage?.getAttribute('width')).toBe('250');
        expect(smolLaunchDarkBadgeImage?.getAttribute('height')).toBe('60');
        expect(smolLaunchDarkBadgeImage?.getAttribute('loading')).toBe('lazy');
        expect(smolLaunchDarkBadgeImage?.className).toContain('hidden');
        expect(smolLaunchDarkBadgeImage?.className).toContain('dark:block');

        const launchLlamaBadgeLink = screen.getByRole('link', {
            name: /As seen on Launch Llama Newsletter/i
        });
        expect(launchLlamaBadgeLink).toHaveProperty(
            'href',
            'https://tools.launchllama.co/?utm_source=badge&utm_medium=referral'
        );
        expect(launchLlamaBadgeLink.getAttribute('target')).toBe('_blank');
        expect(launchLlamaBadgeLink.getAttribute('rel')).toBe(
            'noopener noreferrer'
        );

        const launchLlamaBadgeImages = screen.getAllByAltText(
            'As seen on Launch Llama Newsletter'
        );
        expect(launchLlamaBadgeImages).toHaveLength(2);

        const launchLlamaLightBadgeImage = launchLlamaBadgeImages.find(
            image =>
                image.getAttribute('src') ===
                'https://tools.launchllama.co/featured-badge.png?v=2'
        );
        expect(launchLlamaLightBadgeImage).toBeTruthy();
        expect(launchLlamaLightBadgeImage?.getAttribute('width')).toBe('200');
        expect(launchLlamaLightBadgeImage?.getAttribute('height')).toBe('50');
        expect(launchLlamaLightBadgeImage?.getAttribute('loading')).toBe(
            'lazy'
        );
        expect(launchLlamaLightBadgeImage?.className).toContain('block');
        expect(launchLlamaLightBadgeImage?.className).toContain('dark:hidden');

        const launchLlamaDarkBadgeImage = launchLlamaBadgeImages.find(
            image =>
                image.getAttribute('src') ===
                'https://tools.launchllama.co/featured-badge-white.png?v=2'
        );
        expect(launchLlamaDarkBadgeImage).toBeTruthy();
        expect(launchLlamaDarkBadgeImage?.getAttribute('width')).toBe('200');
        expect(launchLlamaDarkBadgeImage?.getAttribute('height')).toBe('50');
        expect(launchLlamaDarkBadgeImage?.getAttribute('loading')).toBe('lazy');
        expect(launchLlamaDarkBadgeImage?.className).toContain('hidden');
        expect(launchLlamaDarkBadgeImage?.className).toContain('dark:block');

        const superLaunchBadgeLink = screen.getByRole('link', {
            name: /Featured on Super Launch/i
        });
        expect(superLaunchBadgeLink).toHaveProperty(
            'href',
            'https://www.superlaun.ch/products/2933'
        );
        expect(superLaunchBadgeLink.getAttribute('target')).toBe('_blank');
        expect(superLaunchBadgeLink.getAttribute('rel')).toBe('noopener');

        const superLaunchBadgeImage = screen.getByAltText(
            'Featured on Super Launch'
        );
        const superLaunchBadgeImageSrc =
            superLaunchBadgeImage.getAttribute('src');
        expect(superLaunchBadgeImageSrc).toBeTruthy();
        const superLaunchOptimizerUrl = new URL(
            superLaunchBadgeImageSrc ?? '',
            'http://localhost'
        );
        expect(superLaunchOptimizerUrl.pathname).toBe('/_next/image');
        expect(superLaunchOptimizerUrl.searchParams.get('url')).toBe(
            'https://www.superlaun.ch/badge.png'
        );
        expect(superLaunchBadgeImage.getAttribute('width')).toBe('300');
        expect(superLaunchBadgeImage.getAttribute('height')).toBe('300');
        expect(superLaunchBadgeImage.getAttribute('loading')).toBe('lazy');

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
