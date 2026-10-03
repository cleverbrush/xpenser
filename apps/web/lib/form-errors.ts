import { decodeValidationIssues } from '@xpenser/client';
import type { FormActionResult, FormFailure, FormIssue } from './form-result';
import { compoundFieldPointer } from './form-result';

/** An application-owned validation failure, never transported as an exception. */
export class FormInputError extends Error {
    constructor(
        message: string,
        readonly issues: readonly FormIssue[],
        readonly unverifiedEmail?: string
    ) {
        super(message);
    }
}

export function apiErrorStatus(error: unknown): number | undefined {
    return typeof error === 'object' &&
        error !== null &&
        'status' in error &&
        typeof error.status === 'number'
        ? error.status
        : undefined;
}

export function apiErrorMessage(error: unknown): string | undefined {
    const body =
        typeof error === 'object' && error !== null && 'body' in error
            ? error.body
            : undefined;
    return typeof body === 'object' &&
        body !== null &&
        'message' in body &&
        typeof body.message === 'string'
        ? body.message
        : undefined;
}

/** Convert Framework paths to plain issues while preserving existing root errors. */
export function schemaIssues(result: {
    getInvalidProperties(): readonly {
        descriptor: { toJsonPointer(): string };
        errors: readonly string[];
    }[];
    errors?: readonly { message: string }[];
}): readonly FormIssue[] {
    const issues = result.getInvalidProperties().flatMap(entry =>
        entry.errors.map(detail => ({
            pointer: entry.descriptor.toJsonPointer(),
            detail
        }))
    );
    return issues.length
        ? issues
        : (result.errors ?? []).map(error => ({
              pointer: '',
              detail: error.message
          }));
}

/** Decode before Next.js serializes errors; unexpected failures/redirects propagate. */
export function formFailure(error: unknown, fallback: string): FormFailure {
    if (error instanceof FormInputError) {
        return {
            ok: false,
            error: error.message,
            issues: error.issues,
            ...(error.unverifiedEmail
                ? { unverifiedEmail: error.unverifiedEmail }
                : {})
        };
    }
    const issues = decodeValidationIssues(error, { source: 'body' });
    if (issues)
        return {
            ok: false,
            error: fallback,
            issues: issues.map(issue => ({
                ...issue,
                pointer: compoundFieldPointer(issue.pointer)
            }))
        };
    const status = apiErrorStatus(error);
    if (
        status !== undefined &&
        [400, 403, 404, 409, 413, 422].includes(status)
    ) {
        return { ok: false, error: apiErrorMessage(error) ?? fallback };
    }
    throw error;
}

/** Keep authentication and cache/redirect behavior within the feature action. */
export async function runFormAction<T>(
    operation: () => Promise<T>,
    fallback: string
): Promise<FormActionResult<T>> {
    try {
        return { ok: true, data: await operation() };
    } catch (error) {
        return formFailure(error, fallback);
    }
}
