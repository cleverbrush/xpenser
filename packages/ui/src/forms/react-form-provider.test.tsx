/**
 * @vitest-environment jsdom
 */

import { render, screen } from '@testing-library/react';
import { describe, expect, it } from 'vitest';
import { XpenserFormProvider } from './react-form-provider.js';

describe('XpenserFormProvider', () => {
    it('renders children inside the form system provider', () => {
        render(
            <XpenserFormProvider>
                <span>Form content</span>
            </XpenserFormProvider>
        );

        expect(screen.getByText('Form content')).toBeTruthy();
    });
});
