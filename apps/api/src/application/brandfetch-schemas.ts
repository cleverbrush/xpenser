import {
    array,
    boolean,
    type InferType,
    object,
    string
} from '@cleverbrush/schema';

// Optional schemas accept null at runtime; normalize it before validation so
// absent and malformed provider metadata consistently becomes undefined.
const optionalTextSchema = string()
    .optional()
    .addPreprocessor(value => (value == null ? undefined : value))
    .catch(undefined);
const optionalBooleanSchema = boolean()
    .optional()
    .addPreprocessor(value => (value == null ? undefined : value))
    .catch(undefined);

export const BrandfetchSearchResultSchema = object({
    brandId: optionalTextSchema,
    claimed: optionalBooleanSchema,
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
    return BrandfetchSearchResultSchema.parse({
        brandId: value.brandId,
        claimed: value.claimed,
        domain: value.domain,
        icon: value.icon,
        name: value.name
    });
}

export function parseBrandfetchResponse(value: unknown): BrandfetchResponse {
    if (!isObject(value)) throw new Error('Invalid Brandfetch response.');
    return BrandfetchResponseSchema.parse({
        id: value.id,
        name: value.name,
        domain: value.domain,
        description: value.description,
        longDescription: value.longDescription,
        logos: objectArray(value.logos, logo => ({
            type: logo.type,
            formats: objectArray(logo.formats, format => ({
                src: format.src,
                format: format.format
            }))
        })),
        colors: objectArray(value.colors, color => ({
            hex: color.hex,
            type: color.type
        }))
    });
}
