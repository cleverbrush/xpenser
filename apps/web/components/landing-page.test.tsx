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
            screen.getByRole('heading', { level: 1, name: 'xpenser' })
        ).toBeTruthy();
        expect(
            screen.getByText(/Track income, expenses, refunds/i)
        ).toBeTruthy();
        expect(
            screen.getByText(/Learn Cleverbrush from a working app/i)
        ).toBeTruthy();
        expect(screen.getAllByText(/Telegram bot/i).length).toBeGreaterThan(0);
        expect(screen.getAllByText(/MCP server/i).length).toBeGreaterThan(0);
        expect(screen.getAllByText(/self-hosted/i).length).toBeGreaterThan(0);
        expect(screen.getAllByText(/open-source/i).length).toBeGreaterThan(0);
        expect(screen.getAllByText(/MIT licensed/i).length).toBeGreaterThan(0);
        expect(
            screen.getAllByText(/multiple currencies/i).length
        ).toBeGreaterThan(0);
        expect(screen.getAllByText(/Frankfurter/i).length).toBeGreaterThan(0);
        expect(
            screen.getAllByText(/weekly and monthly email summaries/i).length
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
