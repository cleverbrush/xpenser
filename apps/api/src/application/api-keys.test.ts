import { describe, expect, it } from 'vitest';
import {
    ApiKeyNotFoundError,
    generateApiKeyMaterial,
    hashApiKeySecret,
    parseApiKey,
    verifyApiKeySecret
} from './api-keys.js';

describe('api key helpers', () => {
    it('generates parseable keys without storing the plaintext secret', () => {
        const material = generateApiKeyMaterial();
        const parsed = parseApiKey(material.key);

        expect(material.key).toMatch(/^xpk_[a-f0-9]{24}_[A-Za-z0-9_-]+$/);
        expect(material.keyPrefix).toMatch(/^xpk_[a-f0-9]{12}\.\.\.$/);
        expect(parsed).toEqual({
            keyId: material.keyId,
            secret: material.secret
        });
    });

    it('hashes and verifies API key secrets', () => {
        const hash = hashApiKeySecret('secret-1');

        expect(hash).toMatch(/^[a-f0-9]{64}$/);
        expect(hash).not.toContain('secret-1');
        expect(verifyApiKeySecret('secret-1', hash)).toBe(true);
        expect(verifyApiKeySecret('secret-2', hash)).toBe(false);
    });

    it('rejects malformed keys', () => {
        expect(parseApiKey('')).toBeUndefined();
        expect(parseApiKey('xpk_not-hex_secret')).toBeUndefined();
        expect(parseApiKey('Bearer xpk_123_secret')).toBeUndefined();
    });

    it('keeps an explicit not found error for handlers', () => {
        expect(new ApiKeyNotFoundError('missing')).toBeInstanceOf(Error);
    });
});
