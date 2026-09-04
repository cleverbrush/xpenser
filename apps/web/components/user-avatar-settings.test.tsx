/**
 * @vitest-environment jsdom
 */

import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import { UserAvatarLimits, type UserPreference } from '@xpenser/contracts';
import { toast } from '@xpenser/ui';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { UserAvatarSettings } from './user-avatar-settings';

const refresh = vi.fn();
const updateUserAvatarAction = vi.fn();
const deleteUserAvatarAction = vi.fn();
const toastSuccess = vi.spyOn(toast, 'success').mockImplementation(() => 1);

vi.mock('next/navigation', () => ({
    useRouter: () => ({ refresh })
}));

vi.mock('@/lib/actions', () => ({
    updateUserAvatarAction: (formData: FormData) =>
        updateUserAvatarAction(formData),
    deleteUserAvatarAction: () => deleteUserAvatarAction()
}));

function me(overrides: Partial<UserPreference> = {}): UserPreference {
    return {
        id: 1,
        email: 'owner@example.com',
        avatarUrl: undefined,
        hasUploadedAvatar: false,
        defaultCurrency: 'USD',
        countryCode: 'US',
        favoriteCurrencies: [],
        transactionCurrencies: ['USD'],
        timezone: 'UTC',
        mainBudgetId: 1,
        budgets: [],
        hasCategories: true,
        weeklyEmailReportEnabled: true,
        monthlyEmailReportEnabled: true,
        ...overrides
    };
}

describe('UserAvatarSettings', () => {
    afterEach(() => {
        refresh.mockReset();
        updateUserAvatarAction.mockReset();
        deleteUserAvatarAction.mockReset();
        toastSuccess.mockClear();
    });

    it('rejects unsupported avatar files before calling the action', async () => {
        render(<UserAvatarSettings me={me()} />);

        fireEvent.change(screen.getByLabelText('Avatar image'), {
            target: {
                files: [
                    new File(['not an image'], 'avatar.txt', {
                        type: 'text/plain'
                    })
                ]
            }
        });
        fireEvent.click(screen.getByRole('button', { name: 'Upload' }));

        expect((await screen.findByRole('alert')).textContent).toBe(
            'Upload a PNG, JPEG, or WebP image.'
        );
        expect(updateUserAvatarAction).not.toHaveBeenCalled();
        expect(toastSuccess).not.toHaveBeenCalled();
    });

    it('rejects oversized avatar files before calling the action', async () => {
        render(<UserAvatarSettings me={me()} />);

        fireEvent.change(screen.getByLabelText('Avatar image'), {
            target: {
                files: [
                    new File(
                        [new Uint8Array(UserAvatarLimits.maxImageBytes + 1)],
                        'avatar.png',
                        { type: 'image/png' }
                    )
                ]
            }
        });
        fireEvent.click(screen.getByRole('button', { name: 'Upload' }));

        expect((await screen.findByRole('alert')).textContent).toBe(
            'Avatar image must be 512 KB or smaller.'
        );
        expect(updateUserAvatarAction).not.toHaveBeenCalled();
        expect(toastSuccess).not.toHaveBeenCalled();
    });

    it('uploads an avatar and refreshes the current page', async () => {
        updateUserAvatarAction.mockResolvedValue({ success: true });
        render(<UserAvatarSettings me={me()} />);

        fireEvent.change(screen.getByLabelText('Avatar image'), {
            target: {
                files: [
                    new File(['image'], 'avatar.png', { type: 'image/png' })
                ]
            }
        });
        fireEvent.click(screen.getByRole('button', { name: 'Upload' }));

        await waitFor(() =>
            expect(updateUserAvatarAction).toHaveBeenCalledOnce()
        );
        expect(refresh).toHaveBeenCalledOnce();
        expect(toastSuccess).toHaveBeenCalledWith('Avatar uploaded.');
    });

    it('shows server action errors inline', async () => {
        updateUserAvatarAction.mockResolvedValue({
            error: 'Could not upload avatar.'
        });
        render(<UserAvatarSettings me={me()} />);

        fireEvent.change(screen.getByLabelText('Avatar image'), {
            target: {
                files: [
                    new File(['image'], 'avatar.webp', { type: 'image/webp' })
                ]
            }
        });
        fireEvent.click(screen.getByRole('button', { name: 'Upload' }));

        expect((await screen.findByRole('alert')).textContent).toBe(
            'Could not upload avatar.'
        );
        expect(refresh).not.toHaveBeenCalled();
        expect(toastSuccess).not.toHaveBeenCalled();
    });
});
