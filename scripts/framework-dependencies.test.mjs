import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';

describe('Framework package identity', () => {
    it('locks one shared schema installation across all workspaces', () => {
        const lock = JSON.parse(readFileSync(new URL('../package-lock.json', import.meta.url), 'utf8'));
        const schemaPaths = Object.keys(lock.packages).filter(path => path.endsWith('node_modules/@cleverbrush/schema'));
        expect(schemaPaths).toEqual(['node_modules/@cleverbrush/schema']);
        const versions = Object.entries(lock.packages)
            .filter(([path]) => /(?:^|\/)node_modules\/@cleverbrush\/[^/]+$/.test(path))
            .map(([, pkg]) => pkg.version);
        expect(new Set(versions)).toEqual(new Set([lock.packages['apps/api'].dependencies['@cleverbrush/schema']]));
    });

    it('pins every workspace Framework dependency to the same release', () => {
        const lock = JSON.parse(readFileSync(new URL('../package-lock.json', import.meta.url), 'utf8'));
        const expected = lock.packages['apps/api'].dependencies['@cleverbrush/schema'];
        for (const [path] of Object.entries(lock.packages)) {
            if (!/^(apps|packages)\/[^/]+$/.test(path)) continue;
            const manifest = JSON.parse(readFileSync(new URL(`../${path}/package.json`, import.meta.url), 'utf8'));
            for (const group of ['dependencies', 'devDependencies', 'peerDependencies']) {
                for (const [name, version] of Object.entries(manifest[group] ?? {})) {
                    if (name.startsWith('@cleverbrush/')) expect(version, `${path}: ${name}`).toBe(expected);
                }
            }
        }
    });
});
