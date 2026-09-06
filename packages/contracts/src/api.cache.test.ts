import { describe, expect, it } from 'vitest';
import { api } from './api.js';

const cachedReads = [
    ['user-profile', api.auth.me],
    ['telegram-status', api.users.telegramStatus],
    ['api-keys', api.users.listApiKeys],
    ['mcp-connections', api.users.listMcpOAuthConnections],
    ['budgets', api.budgets.list],
    ['currencies', api.currencies.list],
    ['currency-conversion', api.currencies.convert],
    ['categories', api.categories.list],
    ['vendors', api.vendors.list],
    ['vendor', api.vendors.get],
    ['transactions', api.transactions.list],
    ['transaction-export', api.transactions.exportCsv],
    ['transaction-tags', api.transactionTags.list],
    ['dashboard', api.dashboard.summary],
    ['dashboard-window', api.dashboard.window],
    ['stats', api.stats.overview],
    ['stats-window', api.stats.window],
    ['stats-tags', api.stats.tags],
    ['stats-category-trend', api.stats.categoryTrend]
] as const;

const splitGroups = {
    'user-profile': ['telegram-status'],
    vendors: ['vendor'],
    transactions: ['transaction-export'],
    dashboard: ['dashboard-window'],
    stats: ['stats-window', 'stats-tags', 'stats-category-trend']
};

describe('API cache declarations', () => {
    it('gives every cached GET exactly one endpoint-specific response namespace', () => {
        const declaredNames: string[] = [];
        for (const group of Object.values(api)) {
            for (const endpoint of Object.values(group)) {
                const meta = endpoint.introspect();
                if (
                    'cacheTags' in meta &&
                    meta.method === 'GET' &&
                    meta.cacheTags.length > 0
                ) {
                    expect(meta.cacheTags).toHaveLength(1);
                    declaredNames.push(meta.cacheTags[0].name);
                }
            }
        }
        expect(declaredNames.sort()).toEqual(
            cachedReads.map(([name]) => name).sort()
        );
        expect(new Set(declaredNames).size).toBe(declaredNames.length);
    });

    it.each(
        cachedReads
    )('%s selects every declared query and path property', (name, endpoint) => {
        const meta = endpoint.introspect();
        expect(meta.cacheTags.map(tag => tag.name)).toEqual([name]);
        const queryFields = Object.keys(
            meta.querySchema?.introspect().properties ?? {}
        );
        const paramFields =
            typeof meta.pathTemplate === 'string'
                ? []
                : Object.keys(
                      meta.pathTemplate.introspect().objectSchema.introspect()
                          .properties
                  );
        const query = Object.fromEntries(
            queryFields.map(field => [field, `query.${field}`])
        );
        const params = Object.fromEntries(
            paramFields.map(field => [field, `params.${field}`])
        );
        const root = { query, params, body: undefined, headers: {} };
        const [tag] = meta.cacheTags;
        if (!tag) throw new Error(`Missing cache tag for ${name}`);
        const selected = Object.values(tag.properties).map(accessor => {
            const result = accessor.getValue(root);
            expect(result.success).toBe(true);
            return result.value;
        });
        expect(selected.sort()).toEqual(
            [...Object.values(query), ...Object.values(params)].sort()
        );
    });

    it('explicitly expands all existing invalidations without relying on prefix matching', () => {
        for (const group of Object.values(api)) {
            for (const endpoint of Object.values(group)) {
                const meta = endpoint.introspect();
                if (!('cacheTags' in meta) || meta.method === 'GET') continue;
                const names = meta.cacheTags.map(
                    (tag: { name: string }) => tag.name
                );
                for (const [original, additions] of Object.entries(
                    splitGroups
                )) {
                    if (names.includes(original)) {
                        expect(names).toEqual(
                            expect.arrayContaining(additions)
                        );
                    }
                }
            }
        }
    });

    it('invalidates conversion results when timezone or budget currency can change', () => {
        for (const endpoint of [
            api.users.updatePreferences,
            api.budgets.update
        ]) {
            expect(
                endpoint.introspect().cacheTags.map(tag => tag.name)
            ).toContain('currency-conversion');
        }
    });
});
