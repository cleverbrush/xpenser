import { describe, expect, it } from 'vitest';
import type { Config } from '../config.js';
import {
    hashTelegramLinkToken,
    TelegramAccountConflictError,
    TelegramAccountNotLinkedError,
    TelegramLinkTokenInvalidError,
    verifyTelegramServiceSecret
} from './telegram.js';

const config = {
    telegram: {
        serviceSecret: 'change-me-in-production-min32chars'
    }
} as Config;

describe('telegram application helpers', () => {
    it('hashes link tokens without exposing the raw token', () => {
        const hash = hashTelegramLinkToken('token-1');

        expect(hash).toMatch(/^[a-f0-9]{64}$/);
        expect(hash).not.toContain('token-1');
        expect(hashTelegramLinkToken('token-1')).toBe(hash);
        expect(hashTelegramLinkToken('token-2')).not.toBe(hash);
    });

    it('compares service secrets without accepting partial values', () => {
        expect(
            verifyTelegramServiceSecret(
                config,
                'change-me-in-production-min32chars'
            )
        ).toBe(true);
        expect(verifyTelegramServiceSecret(config, undefined)).toBe(false);
        expect(verifyTelegramServiceSecret(config, 'change-me')).toBe(false);
        expect(
            verifyTelegramServiceSecret(
                config,
                'change-me-in-production-min32charx'
            )
        ).toBe(false);
    });

    it('keeps explicit domain errors for handlers', () => {
        expect(new TelegramLinkTokenInvalidError('expired')).toBeInstanceOf(
            Error
        );
        expect(new TelegramAccountConflictError('conflict')).toBeInstanceOf(
            Error
        );
        expect(new TelegramAccountNotLinkedError('missing')).toBeInstanceOf(
            Error
        );
    });
});
