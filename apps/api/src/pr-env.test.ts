import { readFileSync } from 'node:fs';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { describe, expect, it } from 'vitest';

const repoRoot = resolve(dirname(fileURLToPath(import.meta.url)), '../../..');
const prEnvScript = readFileSync(resolve(repoRoot, 'pr-env.sh'), 'utf8');
const shellDomain = '$' + '{DOMAIN}';

describe('PR environment script', () => {
    it('registers Passport against the public /api backend', () => {
        expect(prEnvScript).toContain(
            `https://${shellDomain}/api/auth/passport`
        );
        expect(prEnvScript).not.toContain(
            `https://${shellDomain}/external-api/auth/passport`
        );
    });

    it('does not write stale public API or Auth.js URL overrides', () => {
        expect(prEnvScript).not.toContain('PUBLIC_API_BASE_URL=');
        expect(prEnvScript).toContain(`AUTH_URL=https://${shellDomain}/authjs`);
        expect(prEnvScript).toContain(
            `NEXTAUTH_URL=https://${shellDomain}/authjs`
        );
    });
});
