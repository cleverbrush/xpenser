import { apiErrorStatus, FormInputError } from './form-errors';
import type { FormIssue } from './form-result';

/** Explicit transport-to-form mapping; never infer a field from message text. */
export function uploadIssues(
    error: unknown,
    field: 'image' | 'avatar'
): readonly FormIssue[] | undefined {
    if (![400, 413].includes(apiErrorStatus(error) ?? 0)) return undefined;
    if (!error || typeof error !== 'object' || !('body' in error))
        return undefined;
    const body = error.body;
    if (
        !body ||
        typeof body !== 'object' ||
        !('errors' in body) ||
        !Array.isArray(body.errors)
    )
        return undefined;
    if (
        !body.errors.length ||
        !body.errors.every(
            issue =>
                issue &&
                typeof issue.pointer === 'string' &&
                typeof issue.detail === 'string'
        )
    )
        return undefined;
    return body.errors.map(issue => ({
        pointer:
            issue.pointer === `/files/${field}` ||
            issue.pointer === `files/${field}`
                ? `/${field}`
                : '',
        detail: issue.detail
    }));
}

/** Preserve unexpected errors and redirects for the normal server boundary. */
export function uploadInputError(
    error: unknown,
    field: 'image' | 'avatar',
    fallback: string
): unknown {
    const issues = uploadIssues(error, field);
    return issues ? new FormInputError(fallback, issues) : error;
}
