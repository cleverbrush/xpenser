import type { Config } from '../config.js';

const resendEmailsUrl = 'https://api.resend.com/emails';

export class EmailConfigError extends Error {}

export type SendEmailOptions = {
    readonly html: string;
    readonly subject: string;
    readonly text: string;
    readonly to: string;
};

export async function sendEmail(
    config: Config,
    options: SendEmailOptions
): Promise<string | undefined> {
    if (!config.resend.apiKey) {
        throw new EmailConfigError('RESEND_API_KEY is not set.');
    }

    const response = await fetch(resendEmailsUrl, {
        body: JSON.stringify({
            from: config.resend.emailFrom,
            html: options.html,
            subject: options.subject,
            text: options.text,
            to: options.to
        }),
        headers: {
            Authorization: `Bearer ${config.resend.apiKey}`,
            'Content-Type': 'application/json'
        },
        method: 'POST'
    });

    if (!response.ok) {
        throw new Error(
            `Resend API error ${response.status}: ${await response.text()}`
        );
    }

    const body = (await response.json()) as { id?: string };
    return body.id;
}
