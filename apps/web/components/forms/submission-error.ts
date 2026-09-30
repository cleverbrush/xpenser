import { isNextRedirectError } from './form-utils';

/** Next navigation is control flow, not a recoverable submission error. */
export function submissionError(fallback: string) {
    return (error: unknown) => {
        if (isNextRedirectError(error)) throw error;
        return fallback;
    };
}
