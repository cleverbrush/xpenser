/**
 * @vitest-environment jsdom
 */

import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { FeedbackDialog } from './feedback-dialog';

const submitFeedbackAction = vi.fn();

vi.mock('next/navigation', () => ({
    usePathname: () => '/transactions'
}));
vi.mock('@/lib/feedback-action', () => ({
    submitFeedbackAction: (formData: FormData) => submitFeedbackAction(formData)
}));

describe('FeedbackDialog', () => {
    beforeEach(() => {
        submitFeedbackAction.mockReset();
    });

    it('submits the selected type, text, and current path', async () => {
        submitFeedbackAction.mockResolvedValue({ success: true });
        render(<FeedbackDialog />);

        fireEvent.click(screen.getByRole('button', { name: 'Leave feedback' }));
        fireEvent.change(screen.getByLabelText('Type'), {
            target: { value: 'feature_request' }
        });
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
        expect(screen.getByRole('status').textContent).toContain(
            'your feedback was sent'
        );
        expect(
            (
                screen.getByLabelText(
                    'What would you like to share?'
                ) as HTMLTextAreaElement
            ).value
        ).toBe('');
        expect((screen.getByLabelText('Type') as HTMLSelectElement).value).toBe(
            'feedback'
        );
    });

    it('keeps the dialog open and shows server errors inline', async () => {
        submitFeedbackAction.mockResolvedValue({
            error: 'Could not send feedback. Please try again.'
        });
        render(<FeedbackDialog compact />);

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
    });
});
