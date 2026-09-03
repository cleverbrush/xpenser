export const FeedbackTypes = ['feedback', 'feature_request', 'bug'] as const;
export type FeedbackType = (typeof FeedbackTypes)[number];

export const FeedbackTextMaxLength = 5_000;
const FeedbackPathMaxLength = 2_048;

export type FeedbackInput = {
    readonly path: string;
    readonly text: string;
    readonly type: FeedbackType;
};

export type FeedbackPayload = {
    readonly type: FeedbackType;
    readonly text: string;
    readonly user: {
        readonly id: string;
        readonly email: string;
    };
    readonly context: {
        readonly path: string;
        readonly appUrl: string;
        readonly environment: string;
        readonly submittedAt: string;
    };
};

export type FeedbackDeliveryResult =
    | { readonly ok: true; readonly status: number }
    | {
          readonly ok: false;
          readonly reason: 'http' | 'network' | 'timeout';
          readonly status?: number;
      };

export class FeedbackInputError extends Error {}

function normalizedFormText(value: FormDataEntryValue | null): string {
    return typeof value === 'string'
        ? value.replace(/\r\n?/g, '\n').trim()
        : '';
}

function normalizedPath(value: FormDataEntryValue | null): string {
    const path = normalizedFormText(value);
    if (
        path.length === 0 ||
        path.length > FeedbackPathMaxLength ||
        !path.startsWith('/') ||
        path.startsWith('//')
    ) {
        return '/';
    }
    return path.split(/[?#]/, 1)[0] || '/';
}

export function feedbackInputFromFormData(formData: FormData): FeedbackInput {
    const rawType = normalizedFormText(formData.get('type'));
    if (!FeedbackTypes.includes(rawType as FeedbackType)) {
        throw new FeedbackInputError('Choose a valid feedback type.');
    }

    const text = normalizedFormText(formData.get('text'));
    if (!text) {
        throw new FeedbackInputError('Enter your feedback before sending.');
    }
    if (text.length > FeedbackTextMaxLength) {
        throw new FeedbackInputError(
            `Feedback must be ${FeedbackTextMaxLength.toLocaleString('en')} characters or fewer.`
        );
    }

    return {
        path: normalizedPath(formData.get('path')),
        text,
        type: rawType as FeedbackType
    };
}

function feedbackPayload({
    appUrl,
    environment,
    input,
    now,
    user
}: {
    readonly appUrl: string;
    readonly environment: string;
    readonly input: FeedbackInput;
    readonly now: Date;
    readonly user: FeedbackPayload['user'];
}): FeedbackPayload {
    return {
        type: input.type,
        text: input.text,
        user,
        context: {
            path: input.path,
            appUrl,
            environment,
            submittedAt: now.toISOString()
        }
    };
}

function isTimeoutError(error: unknown): boolean {
    return (
        error instanceof Error &&
        (error.name === 'AbortError' || error.name === 'TimeoutError')
    );
}

export async function deliverFeedback({
    appUrl,
    environment,
    fetcher = fetch,
    input,
    now = new Date(),
    user,
    webhookUrl
}: {
    readonly appUrl: string;
    readonly environment: string;
    readonly fetcher?: typeof fetch;
    readonly input: FeedbackInput;
    readonly now?: Date;
    readonly user: FeedbackPayload['user'];
    readonly webhookUrl: string;
}): Promise<FeedbackDeliveryResult> {
    try {
        const response = await fetcher(webhookUrl, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json'
            },
            body: JSON.stringify(
                feedbackPayload({ appUrl, environment, input, now, user })
            ),
            cache: 'no-store',
            signal: AbortSignal.timeout(10_000)
        });
        return response.ok
            ? { ok: true, status: response.status }
            : { ok: false, reason: 'http', status: response.status };
    } catch (error) {
        return {
            ok: false,
            reason: isTimeoutError(error) ? 'timeout' : 'network'
        };
    }
}
