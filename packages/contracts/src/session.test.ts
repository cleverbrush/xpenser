import { describe, expect, it } from 'vitest';
import { UserSessionMaxAgeSeconds } from './session.js';

describe('user session duration', () => {
    it('lasts two weeks', () => {
        expect(UserSessionMaxAgeSeconds).toBe(1_209_600);
    });
});
