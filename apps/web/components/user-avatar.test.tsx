/**
 * @vitest-environment jsdom
 */

import { render, screen } from '@testing-library/react';
import { describe, expect, it } from 'vitest';
import { UserAvatar } from './user-avatar';

describe('UserAvatar', () => {
    it('renders an image with accessible identity', () => {
        const { container } = render(
            <UserAvatar
                avatarUrl="/app-api/users/2/avatar"
                displayName="Jane Doe"
                email="jane@example.com"
            />
        );

        expect(screen.getByRole('img', { name: 'Jane Doe' })).toBeTruthy();
        expect(container.querySelector('img')?.getAttribute('src')).toBe(
            '/app-api/users/2/avatar'
        );
    });

    it('falls back to email initials', () => {
        render(<UserAvatar email="teammate@example.com" />);

        expect(
            screen.getByRole('img', { name: 'teammate@example.com' })
        ).toBeTruthy();
        expect(screen.getByText('TE')).toBeTruthy();
    });
});
