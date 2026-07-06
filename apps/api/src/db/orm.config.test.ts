import { afterEach, describe, expect, it, vi } from 'vitest';

function stubRequiredApiEnv() {
    vi.stubEnv('NODE_ENV', 'development');
    vi.stubEnv('JWT_SECRET', 'x'.repeat(32));
    vi.stubEnv('WEB_API_SERVICE_SECRET', 'x'.repeat(32));
    vi.stubEnv('TELEGRAM_BOT_SERVICE_SECRET', 'x'.repeat(32));
}

describe('ORM CLI config', () => {
    afterEach(() => {
        vi.unstubAllEnvs();
        vi.resetModules();
    });

    it('exports the app entity map and migration settings for validation', async () => {
        stubRequiredApiEnv();
        vi.resetModules();

        const [{ default: ormConfig }, { entityMap }, { migrationsDirectory }] =
            await Promise.all([
                import('./orm.config.js'),
                import('./schemas.js'),
                import('./migrate.js')
            ]);

        try {
            expect(ormConfig.entities).toBe(entityMap);
            expect(ormConfig.migrations).toEqual({
                directory: migrationsDirectory,
                tableName: 'knex_migrations'
            });
            expect(typeof ormConfig.knex.schema.hasTable).toBe('function');
        } finally {
            await ormConfig.knex.destroy();
        }
    });
});
