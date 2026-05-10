import { describe, expect, it } from 'vitest';
import {
    CategoryInUseError,
    CategoryNotFoundError,
    LastCategoryError
} from './categories.js';

describe('category domain errors', () => {
    it('has explicit errors for delete preconditions', () => {
        expect(new CategoryInUseError('in use')).toBeInstanceOf(Error);
        expect(new CategoryNotFoundError('missing')).toBeInstanceOf(Error);
        expect(new LastCategoryError('required')).toBeInstanceOf(Error);
    });
});
