/**
 * @vitest-environment jsdom
 */

import { render, screen } from '@testing-library/react';
import { describe, expect, it } from 'vitest';
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
});
