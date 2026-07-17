/**
 * @vitest-environment jsdom
 */

import { render, screen } from '@testing-library/react';
import { MDXRemote } from 'next-mdx-remote/rsc';
import { describe, expect, it } from 'vitest';
import { blogMdxOptions } from '@/lib/mdx';
import { mdxComponents } from './mdx-components';

describe('mdxComponents', () => {
    it('renders inline blog screenshots with accessible image text', () => {
        const MdxImage = mdxComponents.img;

        render(
            <mdxComponents.figure>
                <MdxImage
                    alt="Shared budget overview screenshot"
                    src="/blog/shared-budgets-overview.png"
                />
                <mdxComponents.figcaption>
                    Shared budgets keep each transaction inside a selected
                    workspace.
                </mdxComponents.figcaption>
            </mdxComponents.figure>
        );

        const image = screen.getByRole('img', {
            name: 'Shared budget overview screenshot'
        });

        expect(image.getAttribute('src')).toContain(
            'shared-budgets-overview.png'
        );
        expect(image.getAttribute('loading')).toBe('lazy');
        expect(
            screen.getByText(
                'Shared budgets keep each transaction inside a selected workspace.'
            )
        ).toBeTruthy();
    });

    it('renders responsive semantic tables for benchmark data', () => {
        render(
            <mdxComponents.table aria-label="TypeScript build comparison">
                <mdxComponents.thead>
                    <mdxComponents.tr>
                        <mdxComponents.th>Compiler</mdxComponents.th>
                        <mdxComponents.th>Median</mdxComponents.th>
                    </mdxComponents.tr>
                </mdxComponents.thead>
                <mdxComponents.tbody>
                    <mdxComponents.tr>
                        <mdxComponents.td>TypeScript 7</mdxComponents.td>
                        <mdxComponents.td>1.00s</mdxComponents.td>
                    </mdxComponents.tr>
                </mdxComponents.tbody>
            </mdxComponents.table>
        );

        const table = screen.getByRole('table', {
            name: 'TypeScript build comparison'
        });

        expect(table.parentElement?.className).toContain('overflow-auto');
        expect(
            screen.getByRole('columnheader', { name: 'Compiler' })
        ).toBeTruthy();
        expect(screen.getByRole('cell', { name: 'TypeScript 7' })).toBeTruthy();
    });

    it('parses Markdown benchmark tables before rendering components', async () => {
        const content = await MDXRemote({
            components: mdxComponents,
            options: blogMdxOptions,
            source: `| Compiler | Median |
| --- | ---: |
| TypeScript 7 | 8.898s |`
        });

        render(content);

        expect(screen.getByRole('table')).toBeTruthy();
        expect(
            screen.getByRole('columnheader', { name: 'Compiler' })
        ).toBeTruthy();
        expect(screen.getByRole('cell', { name: '8.898s' })).toBeTruthy();
    });
});
