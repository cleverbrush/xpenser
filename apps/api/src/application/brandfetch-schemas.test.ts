import { describe, expect, expectTypeOf, it } from 'vitest';
import {
    type BrandfetchResponse,
    type BrandfetchSearchResult,
    parseBrandfetchResponse,
    parseBrandfetchSearchResult
} from './brandfetch-schemas.js';

describe('Brandfetch boundary schemas', () => {
    it.each([
        undefined,
        null,
        42,
        false,
        [],
        {}
    ])('normalizes invalid optional text %j to undefined', value => {
        expect(
            parseBrandfetchSearchResult({ name: value })?.name
        ).toBeUndefined();
        expect(
            parseBrandfetchResponse({ description: value }).description
        ).toBeUndefined();
    });

    it.each([
        undefined,
        null,
        42,
        'false',
        [],
        {}
    ])('normalizes invalid optional boolean %j to undefined', claimed => {
        expect(
            parseBrandfetchSearchResult({ claimed })?.claimed
        ).toBeUndefined();
    });

    it('preserves valid scalars without trimming or coercion', () => {
        expect(
            parseBrandfetchSearchResult({
                brandId: 'brand',
                claimed: false,
                domain: ' example.com ',
                icon: '',
                name: ' Example '
            })
        ).toEqual({
            brandId: 'brand',
            claimed: false,
            domain: ' example.com ',
            icon: '',
            name: ' Example '
        });
        expect(parseBrandfetchSearchResult({ claimed: true })?.claimed).toBe(
            true
        );
        expectTypeOf<BrandfetchSearchResult['name']>().toEqualTypeOf<
            string | undefined
        >();
        expectTypeOf<BrandfetchSearchResult['claimed']>().toEqualTypeOf<
            boolean | undefined
        >();
        expectTypeOf<BrandfetchResponse['description']>().toEqualTypeOf<
            string | undefined
        >();
    });

    it('selects known fields and filters only non-object array entries without mutating input', () => {
        const input = {
            id: 'brand',
            extra: 'ignored',
            logos: [
                null,
                false,
                [],
                {
                    type: null,
                    extra: 'ignored',
                    formats: [
                        42,
                        null,
                        [],
                        {
                            src: 'https://example.com/logo.svg',
                            format: 'svg',
                            extra: true
                        },
                        { src: false, format: null }
                    ]
                },
                { type: 'icon', formats: 'invalid' }
            ],
            colors: [
                null,
                42,
                [],
                { hex: '#ffffff', type: 'light', extra: true },
                { hex: false, type: null }
            ]
        };
        const before = structuredClone(input);
        const result = parseBrandfetchResponse(input);
        expect(result).toEqual({
            id: 'brand',
            name: undefined,
            domain: undefined,
            description: undefined,
            longDescription: undefined,
            logos: [
                {
                    type: undefined,
                    formats: [
                        { src: 'https://example.com/logo.svg', format: 'svg' },
                        { src: undefined, format: undefined }
                    ]
                },
                { type: 'icon', formats: undefined }
            ],
            colors: [
                { hex: '#ffffff', type: 'light' },
                { hex: undefined, type: undefined }
            ]
        });
        expect(input).toEqual(before);
        expect(
            parseBrandfetchSearchResult({ name: 'Example', extra: true })
        ).not.toHaveProperty('extra');
    });

    it.each([
        undefined,
        null,
        'invalid',
        {}
    ])('normalizes non-array collections %j', value => {
        expect(
            parseBrandfetchResponse({ logos: value, colors: value })
        ).toMatchObject({ logos: undefined, colors: undefined });
    });

    it('preserves empty collections', () => {
        expect(
            parseBrandfetchResponse({ logos: [], colors: [] })
        ).toMatchObject({ logos: [], colors: [] });
    });

    it.each([
        undefined,
        null,
        false,
        42,
        'invalid',
        []
    ])('preserves invalid-root behavior for %j', value => {
        expect(parseBrandfetchSearchResult(value)).toBeUndefined();
        expect(() => parseBrandfetchResponse(value)).toThrow(
            'Invalid Brandfetch response.'
        );
    });
});
