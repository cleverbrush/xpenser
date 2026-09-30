import type { FormIssue, FormSubmitResult } from '@cleverbrush/react-form';

/** Serializable application result, directly consumable by handleSubmit. */
export type FormFailure = Extract<FormSubmitResult, { ok: false }> & {
    readonly unverifiedEmail?: string;
};
export type FormActionResult<T = void> =
    | { readonly ok: true; readonly data: T }
    | FormFailure;

/** Map only explicitly represented controls; never guess a field from text. */
export function mapFormIssues<T>(
    result: FormActionResult<T>,
    mapPointer: (pointer: string) => string
): FormActionResult<T> {
    return result.ok || !result.issues
        ? result
        : {
              ...result,
              issues: result.issues.map(issue => ({
                  ...issue,
                  pointer: mapPointer(issue.pointer)
              }))
          };
}

/** These array inputs edit the whole collection, not individual indexed fields. */
export function compoundFieldPointer(pointer: string): string {
    for (const field of ['/tags', '/favoriteCurrencies']) {
        if (pointer.startsWith(field + '/')) return field;
    }
    return pointer;
}

export function pointerForField(field: string): string {
    return '/' + field.replace(/~/g, '~0').replace(/\//g, '~1');
}

export type { FormIssue };
