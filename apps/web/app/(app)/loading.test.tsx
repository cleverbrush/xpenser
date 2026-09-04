/**
 * @vitest-environment jsdom
 */

import { render, screen } from '@testing-library/react';
import { describe, expect, it } from 'vitest';
import AppLoading from './loading';

describe('AppLoading', () => {
    it('announces route loading while keeping skeleton details decorative', () => {
        const { container } = render(<AppLoading />);

        expect(
            screen.getByRole('status', { name: 'Loading page' })
        ).not.toBeNull();
        expect(container.querySelector('[aria-hidden="true"]')).not.toBeNull();
    });
});
