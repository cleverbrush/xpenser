import {
    array,
    boolean,
    type InferType,
    object,
    string
} from '@cleverbrush/schema';

const optionalTextSchema = string().optional();

export const BrandfetchSearchResultSchema = object({
    brandId: optionalTextSchema,
    claimed: boolean().optional(),
    domain: optionalTextSchema,
    icon: optionalTextSchema,
    name: optionalTextSchema
});

const BrandfetchFormatSchema = object({
    src: optionalTextSchema,
    format: optionalTextSchema
});
const BrandfetchLogoSchema = object({
    type: optionalTextSchema,
    formats: array(BrandfetchFormatSchema).optional()
});
const BrandfetchColorSchema = object({
    hex: optionalTextSchema,
    type: optionalTextSchema
});

export const BrandfetchResponseSchema = object({
    id: optionalTextSchema,
    name: optionalTextSchema,
    domain: optionalTextSchema,
    description: optionalTextSchema,
    longDescription: optionalTextSchema,
    logos: array(BrandfetchLogoSchema).optional(),
    colors: array(BrandfetchColorSchema).optional()
});

export type BrandfetchResponse = InferType<typeof BrandfetchResponseSchema>;
export type BrandfetchSearchResult = InferType<
    typeof BrandfetchSearchResultSchema
>;

const TextSchema = string();
const BooleanSchema = boolean();

function optionalText(value: unknown): string | undefined {
    const parsed = TextSchema.safeParse(value);
    return parsed.valid ? parsed.object : undefined;
}

function isObject(value: unknown): value is Record<string, unknown> {
    return value !== null && typeof value === 'object' && !Array.isArray(value);
}

function objectArray<T>(
    value: unknown,
    parse: (item: Record<string, unknown>) => T
): T[] | undefined {
    if (!Array.isArray(value)) return undefined;
    const entries: unknown[] = value;
    return entries.filter(isObject).map(parse);
}

// Ignore malformed optional metadata at the external boundary. The objects
// passed into mappers have fully validated, schema-inferred field types.
export function parseBrandfetchSearchResult(
    value: unknown
): BrandfetchSearchResult | undefined {
    if (!isObject(value)) return undefined;
    const claimed = BooleanSchema.safeParse(value.claimed);
    return BrandfetchSearchResultSchema.parse({
        brandId: optionalText(value.brandId),
        claimed: claimed.valid ? claimed.object : undefined,
        domain: optionalText(value.domain),
        icon: optionalText(value.icon),
        name: optionalText(value.name)
    });
}

export function parseBrandfetchResponse(value: unknown): BrandfetchResponse {
    if (!isObject(value)) throw new Error('Invalid Brandfetch response.');
    return BrandfetchResponseSchema.parse({
        id: optionalText(value.id),
        name: optionalText(value.name),
        domain: optionalText(value.domain),
        description: optionalText(value.description),
        longDescription: optionalText(value.longDescription),
        logos: objectArray(value.logos, logo => ({
            type: optionalText(logo.type),
            formats: objectArray(logo.formats, format => ({
                src: optionalText(format.src),
                format: optionalText(format.format)
            }))
        })),
        colors: objectArray(value.colors, color => ({
            hex: optionalText(color.hex),
            type: optionalText(color.type)
        }))
    });
}
