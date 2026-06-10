import { describe, expect, it } from 'vitest';
import { serializeJsonLd } from './json-ld';

describe('serializeJsonLd', () => {
    it('escapes less-than characters while preserving parseable JSON', () => {
        const serialized = serializeJsonLd({
            '@context': 'https://schema.org',
            name: 'xpenser <finance>'
        });

        expect(serialized).toContain('\\u003cfinance>');
        expect(JSON.parse(serialized)).toEqual({
            '@context': 'https://schema.org',
            name: 'xpenser <finance>'
        });
    });
});
