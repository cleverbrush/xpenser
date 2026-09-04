/**
 * @vitest-environment jsdom
 */

import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import { toast } from '@xpenser/ui';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { ResendEmailConfirmationForm } from './resend-email-confirmation-form';

const resendEmailConfirmationAction = vi.fn();
const toastSuccess = vi.spyOn(toast, 'success').mockImplementation(() => 1);

vi.mock('@/lib/actions', () => ({
    resendEmailConfirmationAction: (formData: FormData) =>
        resendEmailConfirmationAction(formData)
}));

describe('ResendEmailConfirmationForm', () => {
    afterEach(() => {
        resendEmailConfirmationAction.mockReset();
        toastSuccess.mockClear();
    });

    it('shows the server success message in a toast', async () => {
        resendEmailConfirmationAction.mockResolvedValue({
            message: 'Check your inbox for a new confirmation link.'
        });
        render(
            <ResendEmailConfirmationForm initialEmail="owner@example.com" />
        );

        fireEvent.click(screen.getByRole('button', { name: 'Send link' }));

        await waitFor(() =>
            expect(resendEmailConfirmationAction).toHaveBeenCalledOnce()
        );
        const submitted = resendEmailConfirmationAction.mock.calls[0]?.[0] as
            | FormData
            | undefined;
        expect(submitted?.get('email')).toBe('owner@example.com');
        expect(toastSuccess).toHaveBeenCalledWith(
            'Check your inbox for a new confirmation link.'
        );
    });

    it('keeps server errors inline without showing a success toast', async () => {
        resendEmailConfirmationAction.mockResolvedValue({
            error: 'Could not send a confirmation link.'
        });
        render(
            <ResendEmailConfirmationForm initialEmail="owner@example.com" />
        );

        fireEvent.click(screen.getByRole('button', { name: 'Send link' }));

        expect((await screen.findByRole('alert')).textContent).toBe(
            'Could not send a confirmation link.'
        );
        expect(toastSuccess).not.toHaveBeenCalled();
    });
});
