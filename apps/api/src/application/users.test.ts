import { describe, expect, it } from 'vitest';
import {
    InvalidPassportIdentityError,
    PasswordMismatchError
} from './users.js';

describe('user domain errors', () => {
    it('uses a specific error for password mismatch', () => {
        expect(new PasswordMismatchError('x')).toBeInstanceOf(Error);
    });

    it('uses a specific error for invalid Passport identities', () => {
        expect(new InvalidPassportIdentityError('x')).toBeInstanceOf(Error);
    });
});
