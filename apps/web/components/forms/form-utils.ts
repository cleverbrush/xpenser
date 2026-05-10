export function valuesToFormData(values: Record<string, unknown>) {
    const formData = new FormData();

    for (const [key, value] of Object.entries(values)) {
        if (value === undefined || value === null) {
            continue;
        }

        const appendValue = (item: unknown) => {
            if (item === undefined || item === null) {
                return;
            }
            formData.append(
                key,
                item instanceof Date ? item.toISOString() : String(item)
            );
        };

        if (Array.isArray(value)) {
            for (const item of value) {
                appendValue(item);
            }
            continue;
        }

        appendValue(value);
    }

    return formData;
}

export function isNextRedirectError(error: unknown) {
    return (
        typeof error === 'object' &&
        error !== null &&
        'digest' in error &&
        typeof error.digest === 'string' &&
        error.digest.startsWith('NEXT_REDIRECT')
    );
}
