import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';

describe('Framework package identity', () => {
    it('locks one shared schema installation across all workspaces', () => {
        const lock = JSON.parse(readFileSync(new URL('../package-lock.json', import.meta.url), 'utf8'));
        const schemaPaths = Object.keys(lock.packages).filter(path => path.endsWith('node_modules/@cleverbrush/schema'));
        expect(schemaPaths).toEqual(['node_modules/@cleverbrush/schema']);
        const versions = Object.entries(lock.packages)
            .filter(([path]) => path.includes('node_modules/@cleverbrush/'))
            .map(([, pkg]) => pkg.version);
        expect(new Set(versions)).toEqual(new Set([lock.packages['apps/api'].dependencies['@cleverbrush/schema']]));
    });
});
