import { describe, expect, it, vi } from 'vitest';
import {
    deliverFeedback,
    FeedbackInputError,
    FeedbackTextMaxLength,
    feedbackInputFromFormData
} from './feedback';

function formData(values: Record<string, string>): FormData {
    const result = new FormData();
    for (const [key, value] of Object.entries(values)) {
        result.set(key, value);
    }
    return result;
}

describe('feedback input', () => {
    it('normalizes valid feedback input', () => {
        expect(
            feedbackInputFromFormData(
                formData({
                    path: '/dashboard?period=month',
                    text: '  First line\r\nSecond line  ',
                    type: 'feature_request'
                })
            )
        ).toEqual({
            path: '/dashboard',
            text: 'First line\nSecond line',
            type: 'feature_request'
        });
    });

    it('rejects invalid types and empty or oversized text', () => {
        expect(() =>
            feedbackInputFromFormData(formData({ text: 'Hello', type: 'idea' }))
        ).toThrow(FeedbackInputError);
        expect(() =>
            feedbackInputFromFormData(formData({ text: '   ', type: 'bug' }))
        ).toThrow('Enter your feedback before sending.');
        expect(() =>
            feedbackInputFromFormData(
                formData({
                    text: 'x'.repeat(FeedbackTextMaxLength + 1),
                    type: 'feedback'
                })
            )
        ).toThrow('Feedback must be 5,000 characters or fewer.');
    });

    it('falls back to the root path for untrusted path values', () => {
        expect(
            feedbackInputFromFormData(
                formData({
                    path: '//other.example.com/private',
                    text: 'Hello',
                    type: 'feedback'
                })
            ).path
        ).toBe('/');
    });
});

describe('feedback delivery', () => {
    const input = {
        path: '/dashboard',
        text: 'Please add forecasts.',
        type: 'feature_request' as const
    };
    const user = { id: '7', email: 'jane@example.com' };

    it('posts the expected JSON payload without retries', async () => {
        const fetcher = vi
            .fn<typeof fetch>()
            .mockResolvedValue(new Response(null, { status: 204 }));

        const result = await deliverFeedback({
            appUrl: 'https://xpenser.example.com',
            environment: 'production',
            fetcher,
            input,
            now: new Date('2026-09-03T12:00:00.000Z'),
            user,
            webhookUrl: 'https://n8n.example.com/webhook/feedback'
        });

        expect(result).toEqual({ ok: true, status: 204 });
        expect(fetcher).toHaveBeenCalledOnce();
        const [url, init] = fetcher.mock.calls[0] ?? [];
        expect(url).toBe('https://n8n.example.com/webhook/feedback');
        expect(init).toEqual(
            expect.objectContaining({
                method: 'POST',
                cache: 'no-store',
                headers: { 'Content-Type': 'application/json' }
            })
        );
        expect(JSON.parse(String(init?.body))).toEqual({
            type: 'feature_request',
            text: 'Please add forecasts.',
            user,
            context: {
                path: '/dashboard',
                appUrl: 'https://xpenser.example.com',
                environment: 'production',
                submittedAt: '2026-09-03T12:00:00.000Z'
            }
        });
    });

    it('reports HTTP, network, and timeout failures', async () => {
        const httpFailure = vi
            .fn<typeof fetch>()
            .mockResolvedValue(new Response(null, { status: 503 }));
        const networkFailure = vi
            .fn<typeof fetch>()
            .mockRejectedValue(new Error('connection refused'));
        const timeout = new Error('timed out');
        timeout.name = 'TimeoutError';
        const timeoutFailure = vi.fn<typeof fetch>().mockRejectedValue(timeout);

        await expect(
            deliverFeedback({
                appUrl: 'http://localhost:3000',
                environment: 'test',
                fetcher: httpFailure,
                input,
                user,
                webhookUrl: 'http://localhost:5678/webhook/feedback'
            })
        ).resolves.toEqual({ ok: false, reason: 'http', status: 503 });
        await expect(
            deliverFeedback({
                appUrl: 'http://localhost:3000',
                environment: 'test',
                fetcher: networkFailure,
                input,
                user,
                webhookUrl: 'http://localhost:5678/webhook/feedback'
            })
        ).resolves.toEqual({ ok: false, reason: 'network' });
        await expect(
            deliverFeedback({
                appUrl: 'http://localhost:3000',
                environment: 'test',
                fetcher: timeoutFailure,
                input,
                user,
                webhookUrl: 'http://localhost:5678/webhook/feedback'
            })
        ).resolves.toEqual({ ok: false, reason: 'timeout' });
    });
});
