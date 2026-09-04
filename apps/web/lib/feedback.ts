import {
    FeedbackFormSchema,
    type FeedbackFormValues,
    type FeedbackType
} from './feedback-schema';

export {
    FeedbackTextMaxLength,
    type FeedbackType,
    FeedbackTypes
} from './feedback-schema';

const FeedbackPathMaxLength = 2_048;

export type FeedbackInput = FeedbackFormValues & { readonly path: string };

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

function normalizedFormString(value: FormDataEntryValue | null): string {
    return typeof value === 'string' ? value.replace(/\r\n?/g, '\n') : '';
}

function normalizedPath(value: FormDataEntryValue | null): string {
    const path = normalizedFormString(value).trim();
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
    const untrustedValues = {
        text: normalizedFormString(formData.get('text')),
        type: normalizedFormString(formData.get('type'))
    } as FeedbackFormValues;
    const result = FeedbackFormSchema.validate(untrustedValues);
    if (!result.valid || !result.object) {
        const message =
            result.getErrorsFor(field => field.type).errors[0] ??
            result.getErrorsFor(field => field.text).errors[0] ??
            'Check your feedback and try again.';
        throw new FeedbackInputError(message);
    }

    return {
        path: normalizedPath(formData.get('path')),
        ...result.object
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
