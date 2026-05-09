import { describe, expect, it } from 'vitest';
import { PasswordMismatchError } from './users.js';

describe('user domain errors', () => {
    it('uses a specific error for password mismatch', () => {
        expect(new PasswordMismatchError('x')).toBeInstanceOf(Error);
    });
});
