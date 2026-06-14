import { describe, expect, it } from 'vitest';
import {
    applyHostedPassportDefaults,
    HostedXpenserOrigin,
    HostedXpenserPassportDefaults,
    isHostedXpenserAppUrl
} from './hosted-auth.js';

describe('hosted auth defaults', () => {
    it('recognizes the hosted xpenser origin', () => {
        expect(isHostedXpenserAppUrl(HostedXpenserOrigin)).toBe(true);
        expect(isHostedXpenserAppUrl(`${HostedXpenserOrigin}/dashboard`)).toBe(
            true
        );
        expect(isHostedXpenserAppUrl('https://self.example.com')).toBe(false);
        expect(isHostedXpenserAppUrl('not a url')).toBe(false);
    });

    it('applies Passport defaults only for the hosted app', () => {
        expect(applyHostedPassportDefaults(HostedXpenserOrigin, {})).toEqual(
            HostedXpenserPassportDefaults
        );
        expect(
            applyHostedPassportDefaults('https://self.example.com', {})
        ).toEqual({});
    });

    it('preserves explicit hosted Passport config values', () => {
        expect(
            applyHostedPassportDefaults(HostedXpenserOrigin, {
                baseUrl: 'https://auth.override.example.com',
                project: 'custom-project',
                environment: 'staging'
            })
        ).toEqual({
            baseUrl: 'https://auth.override.example.com',
            project: 'custom-project',
            environment: 'staging'
        });
    });
});
