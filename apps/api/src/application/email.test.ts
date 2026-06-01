import { afterEach, describe, expect, it, vi } from 'vitest';
import type { Config } from '../config.js';
import { EmailConfigError, sendEmail } from './email.js';

const config = {
    resend: {
        apiKey: 're_test',
        emailFrom: 'reports@example.com'
    }
} as Config;

describe('sendEmail', () => {
    afterEach(() => {
        vi.restoreAllMocks();
    });

    it('posts plain text and HTML email through Resend', async () => {
        const fetchSpy = vi.spyOn(globalThis, 'fetch').mockResolvedValue({
            ok: true,
            json: () => Promise.resolve({ id: 'email_123' })
        } as Response);

        await expect(
            sendEmail(config, {
                html: '<p>Hello</p>',
                subject: 'Report',
                text: 'Hello',
                to: 'user@example.com'
            })
        ).resolves.toBe('email_123');

        expect(fetchSpy).toHaveBeenCalledWith(
            'https://api.resend.com/emails',
            expect.objectContaining({
                method: 'POST',
                headers: expect.objectContaining({
                    Authorization: 'Bearer re_test'
                })
            })
        );
    });

    it('throws when Resend is not configured', async () => {
        await expect(
            sendEmail({ resend: { emailFrom: 'x' } } as Config, {
                html: '',
                subject: '',
                text: '',
                to: 'user@example.com'
            })
        ).rejects.toBeInstanceOf(EmailConfigError);
    });
});
