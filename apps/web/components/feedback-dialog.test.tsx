/**
 * @vitest-environment jsdom
 */

import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import { toast, XpenserFormProvider } from '@xpenser/ui';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { FeedbackDialog } from './feedback-dialog';

Element.prototype.scrollIntoView = vi.fn();
HTMLElement.prototype.hasPointerCapture = vi.fn();
HTMLElement.prototype.setPointerCapture = vi.fn();
HTMLElement.prototype.releasePointerCapture = vi.fn();

const submitFeedbackAction = vi.fn();
const toastSuccess = vi.spyOn(toast, 'success').mockImplementation(() => 1);

vi.mock('next/navigation', () => ({
    usePathname: () => '/transactions'
}));
vi.mock('@/lib/feedback-action', () => ({
    submitFeedbackAction: (formData: FormData) => submitFeedbackAction(formData)
}));

function renderFeedbackDialog(compact = false) {
    return render(
        <XpenserFormProvider>
            <FeedbackDialog compact={compact} />
        </XpenserFormProvider>
    );
}

describe('FeedbackDialog', () => {
    beforeEach(() => {
        submitFeedbackAction.mockReset();
        toastSuccess.mockClear();
    });

    it('submits the selected type, text, and current path', async () => {
        submitFeedbackAction.mockResolvedValue({ success: true });
        renderFeedbackDialog();

        fireEvent.click(screen.getByRole('button', { name: 'Leave feedback' }));
        fireEvent.pointerDown(screen.getByRole('combobox', { name: 'Type' }), {
            button: 0,
            ctrlKey: false,
            pointerType: 'mouse'
        });
        fireEvent.click(
            await screen.findByRole('option', { name: 'Feature request' })
        );
        fireEvent.change(
            screen.getByLabelText('What would you like to share?'),
            {
                target: { value: 'Please add a forecast view.' }
            }
        );
        fireEvent.click(screen.getByRole('button', { name: 'Send feedback' }));

        await waitFor(() =>
            expect(submitFeedbackAction).toHaveBeenCalledOnce()
        );
        const submitted = submitFeedbackAction.mock.calls[0]?.[0] as FormData;
        expect(submitted.get('type')).toBe('feature_request');
        expect(submitted.get('text')).toBe('Please add a forecast view.');
        expect(submitted.get('path')).toBe('/transactions');
        await waitFor(() =>
            expect(
                screen.queryByRole('dialog', { name: 'Leave feedback' })
            ).toBeNull()
        );
        expect(toastSuccess).toHaveBeenCalledWith(
            'Thanks — your feedback was sent.'
        );

        fireEvent.click(screen.getByRole('button', { name: 'Leave feedback' }));
        expect(
            (
                screen.getByLabelText(
                    'What would you like to share?'
                ) as HTMLTextAreaElement
            ).value
        ).toBe('');
        expect(
            screen.getByRole('combobox', { name: 'Type' }).textContent
        ).toContain('Feedback');
    });

    it('keeps the dialog open and shows server errors inline', async () => {
        submitFeedbackAction.mockResolvedValue({
            error: 'Could not send feedback. Please try again.'
        });
        renderFeedbackDialog(true);

        fireEvent.click(screen.getByRole('button', { name: 'Leave feedback' }));
        fireEvent.change(
            screen.getByLabelText('What would you like to share?'),
            {
                target: { value: 'Something broke.' }
            }
        );
        fireEvent.click(screen.getByRole('button', { name: 'Send feedback' }));

        expect((await screen.findByRole('alert')).textContent).toBe(
            'Could not send feedback. Please try again.'
        );
        expect(
            screen.getByRole('dialog', { name: 'Leave feedback' })
        ).toBeTruthy();
        expect(toastSuccess).not.toHaveBeenCalled();
    });

    it('shows schema validation errors without calling the server action', async () => {
        renderFeedbackDialog();

        fireEvent.click(screen.getByRole('button', { name: 'Leave feedback' }));
        fireEvent.change(
            screen.getByLabelText('What would you like to share?'),
            { target: { value: '   ' } }
        );
        fireEvent.click(screen.getByRole('button', { name: 'Send feedback' }));

        expect(
            (await screen.findByText('Enter your feedback before sending.'))
                .textContent
        ).toContain('Enter your feedback before sending.');
        expect(submitFeedbackAction).not.toHaveBeenCalled();
        expect(toastSuccess).not.toHaveBeenCalled();
    });
});
