import { readFileSync } from 'node:fs';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { describe, expect, it } from 'vitest';

const repoRoot = resolve(dirname(fileURLToPath(import.meta.url)), '../../..');
const prEnvScript = readFileSync(resolve(repoRoot, 'pr-env.sh'), 'utf8');
const shellDomain = '$' + '{DOMAIN}';
const shellPassportProject = '$' + '{PASSPORT_PROJECT}';
const shellPassportEnvironment = '$' + '{PASSPORT_ENVIRONMENT}';
const shellPostgresDb = '$' + '{POSTGRES_DB}';
const shellFeedbackWebhookUrl = '$' + '{FEEDBACK_WEBHOOK_URL:-}';

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

    it('generates Passport Google sign-in settings for PR deployments', () => {
        expect(prEnvScript).toContain('GOOGLE_SIGN_IN_MODE=passport');
        expect(prEnvScript).toContain(
            `PASSPORT_PROJECT=${shellPassportProject}`
        );
        expect(prEnvScript).toContain(
            `PASSPORT_ENVIRONMENT=${shellPassportEnvironment}`
        );
        expect(prEnvScript).toContain('AUTH_GOOGLE_ID=');
        expect(prEnvScript).toContain('AUTH_GOOGLE_SECRET=');
    });

    it('passes the optional feedback webhook into PR deployments', () => {
        expect(prEnvScript).toContain('read_secret_line FEEDBACK_WEBHOOK_URL');
        expect(prEnvScript).toContain(
            `FEEDBACK_WEBHOOK_URL=${shellFeedbackWebhookUrl}`
        );
    });

    it('reinitializes when the PR database marker predates the Docker volume', () => {
        expect(prEnvScript).toContain('database_initialized()');
        expect(prEnvScript).toContain(
            `local volume_name="$` + `{COMPOSE_PROJECT}_postgres_data"`
        );
        expect(prEnvScript).toContain(
            `docker volume inspect "$volume_name" --format '{{.CreatedAt}}'`
        );
        expect(prEnvScript).toContain(
            `marker_epoch="$(stat -c '%Y' "$DB_INITIALIZED_FILE"`
        );
        expect(prEnvScript).toContain(
            'if (( marker_epoch < volume_epoch )); then'
        );
    });

    it('resets only the PR database schema before restoring production', () => {
        expect(prEnvScript).toContain('reset_pr_database()');
        expect(prEnvScript).toContain(
            `log "Resetting PR database ${shellPostgresDb} before restore"`
        );
        expect(prEnvScript).toContain('psql -v ON_ERROR_STOP=1');
        expect(prEnvScript).toContain('DROP SCHEMA IF EXISTS public CASCADE;');
        expect(prEnvScript).toContain('reset_pr_database "$pr_container"');
    });
});
