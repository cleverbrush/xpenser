import { describe, expect, it } from 'vitest';
import { endpoints } from './endpoints.js';
import { handlers } from './handlers/index.js';

function sortedKeys(value: object): string[] {
    return Object.keys(value).sort();
}

describe('api endpoint map', () => {
    it('mounts every implemented handler', () => {
        expect(sortedKeys(endpoints)).toEqual(sortedKeys(handlers));

        for (const section of sortedKeys(handlers)) {
            expect(
                sortedKeys(endpoints[section as keyof typeof endpoints])
            ).toEqual(sortedKeys(handlers[section as keyof typeof handlers]));
        }
    });
});
