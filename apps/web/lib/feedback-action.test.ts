import { beforeEach, describe, expect, it, vi } from 'vitest';

const mocks = vi.hoisted(() => ({
    getSessionOrRedirect: vi.fn(),
    info: vi.fn(),
    warn: vi.fn(),
    webConfig: {
        appUrl: 'https://xpenser.example.com',
        feedback: {
            webhookUrl: 'https://n8n.example.com/webhook/feedback' as
                | string
                | undefined
        },
        nodeEnv: 'production'
    }
}));

vi.mock('./api', () => ({
    getSessionOrRedirect: mocks.getSessionOrRedirect
}));
vi.mock('./config', () => ({ webConfig: mocks.webConfig }));
vi.mock('./logger', () => ({
    loggerFor: () => ({ info: mocks.info, warn: mocks.warn })
}));

import { submitFeedbackAction } from './feedback-action';

function feedbackForm(text = 'Helpful feedback'): FormData {
    const formData = new FormData();
    formData.set('path', '/dashboard');
    formData.set('text', text);
    formData.set('type', 'feedback');
    return formData;
}

describe('submitFeedbackAction', () => {
    beforeEach(() => {
        vi.restoreAllMocks();
        vi.unstubAllGlobals();
        mocks.getSessionOrRedirect.mockReset();
        mocks.info.mockReset();
        mocks.warn.mockReset();
        mocks.webConfig.feedback.webhookUrl =
            'https://n8n.example.com/webhook/feedback';
        mocks.getSessionOrRedirect.mockResolvedValue({
            apiToken: 'token',
            user: { id: '12', email: 'owner@example.com' }
        });
    });

    it('does not call the webhook when authentication fails', async () => {
        const authenticationError = new Error('authentication redirect');
        mocks.getSessionOrRedirect.mockRejectedValue(authenticationError);
        const fetcher = vi.fn<typeof fetch>();
        vi.stubGlobal('fetch', fetcher);

        await expect(submitFeedbackAction(feedbackForm())).rejects.toBe(
            authenticationError
        );
        expect(fetcher).not.toHaveBeenCalled();
    });

    it('requires an authenticated session and delivers valid input', async () => {
        const fetcher = vi
            .fn<typeof fetch>()
            .mockResolvedValue(new Response(null, { status: 200 }));
        vi.stubGlobal('fetch', fetcher);

        await expect(submitFeedbackAction(feedbackForm())).resolves.toEqual({
            success: true
        });

        expect(mocks.getSessionOrRedirect).toHaveBeenCalledOnce();
        expect(fetcher).toHaveBeenCalledOnce();
        expect(mocks.info).toHaveBeenCalledWith(
            'Feedback webhook delivered',
            expect.objectContaining({
                FeedbackType: 'feedback',
                HttpStatus: 200
            })
        );
    });

    it('returns unavailable without calling the webhook when disabled', async () => {
        mocks.webConfig.feedback.webhookUrl = undefined;
        const fetcher = vi.fn<typeof fetch>();
        vi.stubGlobal('fetch', fetcher);

        await expect(submitFeedbackAction(feedbackForm())).resolves.toEqual({
            error: 'Feedback is not available.'
        });
        expect(fetcher).not.toHaveBeenCalled();
    });

    it('returns validation and delivery errors safely', async () => {
        await expect(
            submitFeedbackAction(feedbackForm('   '))
        ).resolves.toEqual({
            error: 'Enter your feedback before sending.'
        });

        const fetcher = vi
            .fn<typeof fetch>()
            .mockResolvedValue(
                new Response('private n8n error', { status: 500 })
            );
        vi.stubGlobal('fetch', fetcher);
        await expect(submitFeedbackAction(feedbackForm())).resolves.toEqual({
            error: 'Could not send feedback. Please try again.'
        });
        expect(mocks.warn).toHaveBeenCalledWith(
            'Feedback webhook delivery failed',
            expect.objectContaining({
                FeedbackType: 'feedback',
                FailureReason: 'http',
                HttpStatus: 500
            })
        );
    });
});
