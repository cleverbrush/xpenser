function normalize(values: readonly number[]): number[] {
    const magnitudes = values.map(value => Math.abs(value));
    const max = Math.max(...magnitudes, 0);
    if (max <= 0) {
        return values.map(() => 0);
    }

    return magnitudes.map(value => Math.round((value / max) * 100));
}

export function datatypeExpression(
    kind: 'b' | 'l',
    values: readonly number[],
    options: { readonly maxPoints?: number } = { maxPoints: 20 }
): string {
    const normalized = normalize(values);
    const points = options.maxPoints
        ? normalized.slice(-options.maxPoints)
        : normalized;

    return `{${kind}:${points
        .map(value => Math.max(0, Math.min(100, value)))
        .join(',')}}`;
}

export function datatypePieExpression(value: number): string {
    const normalized = Number.isFinite(value) ? value : 0;
    const percent = Math.round(Math.max(0, Math.min(100, normalized)));

    return `{p:${percent}}`;
}

export function DatatypeChart({
    expression,
    className
}: {
    readonly expression: string;
    readonly className?: string;
}) {
    return (
        <span
            aria-hidden
            className={`datatype-chart text-2xl leading-none ${className ?? ''}`}
        >
            {expression}
        </span>
    );
}
