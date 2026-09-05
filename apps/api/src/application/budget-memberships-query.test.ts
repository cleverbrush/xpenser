import { createDb } from '@cleverbrush/orm';
import knexFactory from 'knex';
import { describe, expect, it } from 'vitest';
import { entityMap } from '../db/schemas.js';
import {
    budgetAdminCountQuery,
    budgetMembershipsQuery,
    budgetMembersQuery,
    reportBudgetsQuery,
    uniqueActiveBudgetNameQuery
} from './budget-queries.js';

describe('budget membership database queries', () => {
    it('filters active budgets and orders the final SQL result with aliased columns', async () => {
        const knex = knexFactory({ client: 'pg' });
        const compiled = budgetMembershipsQuery(knex, 7, 'active', 9)
            .toKnexQuery()
            .toSQL();

        expect(compiled.sql).toContain(
            '"budgets"."default_currency" as "defaultCurrency"'
        );
        expect(compiled.sql).toContain(
            '"budgets"."country_code" as "countryCode"'
        );
        expect(compiled.sql).toContain(
            '"budgets"."created_at" as "budgetCreatedAt"'
        );
        expect(compiled.sql).toContain(
            '"budget_members"."created_at" as "createdAt"'
        );
        expect(compiled.sql).toContain('"budget_members"."user_id" = ?');
        expect(compiled.sql).toContain('"budgets"."archived_at" is null');
        expect(compiled.sql).toMatch(
            /order by case when "budget_members"\."budget_id" = \? then 0 else 1 end, "budget_members"\."display_name" asc$/
        );
        expect(compiled.sql).not.toContain('with "originalQuery"');
        expect(compiled.bindings).toEqual([7, 9]);

        await knex.destroy();
    });

    it('selects archived or all budgets in SQL', async () => {
        const knex = knexFactory({ client: 'pg' });
        expect(budgetMembershipsQuery(knex, 7, 'archived').toQuery()).toContain(
            '"budgets"."archived_at" is not null'
        );
        expect(budgetMembershipsQuery(knex, 7, 'all').toQuery()).not.toMatch(
            /"archived_at" is/
        );
        await knex.destroy();
    });

    it('checks literal case-insensitive names with a bounded, user-scoped SQL query', async () => {
        const knex = knexFactory({ client: 'pg' });
        const db = createDb(knex, entityMap);
        const compiled = uniqueActiveBudgetNameQuery(db, 7, 'Travel_%', 9)
            .toKnexQuery()
            .toSQL();
        expect(compiled.sql).toContain('"user_id" = ?');
        expect(compiled.sql).toContain(
            '"budget_id" in (select "id" from "budgets" where "archived_at" is null)'
        );
        expect(compiled.sql).toContain('lower("display_name") = lower(?)');
        expect(compiled.sql).toContain('not "budget_id" = ?');
        expect(compiled.sql).toMatch(/limit \?$/);
        expect(compiled.sql).not.toMatch(/like/i);
        expect(compiled.bindings).toEqual([7, 'Travel_%', 9, 1]);
        expect(
            uniqueActiveBudgetNameQuery(db, 7, 'Travel').toQuery()
        ).not.toContain('not "budget_id"');
        await knex.destroy();
    });

    it('orders members by email in SQL and selects only summary avatar fields', async () => {
        const knex = knexFactory({ client: 'pg' });
        const compiled = budgetMembersQuery(knex, 9).toKnexQuery().toSQL();
        expect(compiled.sql).toContain('"budget_members"."budget_id" = ?');
        expect(compiled.sql).toMatch(/order by "users"\."email" asc$/);
        expect(compiled.sql).toContain('"users"."avatar_url" as "avatarUrl"');
        expect(compiled.sql).not.toMatch(
            /password_hash|avatar_image_base64|originalQuery/
        );
        expect(compiled.bindings).toEqual([9]);
        await knex.destroy();
    });

    it('counts admins without selecting membership records', async () => {
        const knex = knexFactory({ client: 'pg' });
        const db = createDb(knex, entityMap);
        const compiled = budgetAdminCountQuery(db, 9).toKnexQuery().toSQL();
        expect(compiled.sql).toBe(
            'select count(*) from "budget_members" where "budget_id" = ? and "role" = ?'
        );
        expect(compiled.bindings).toEqual([9, 'admin']);
        await knex.destroy();
    });

    it('filters and orders report budgets in the final SELECT', async () => {
        const knex = knexFactory({ client: 'pg' });
        const compiled = reportBudgetsQuery(knex, 7).toKnexQuery().toSQL();
        expect(compiled.sql).toContain('"archived_at" is null');
        expect(compiled.sql).toContain('"budget_id" as "id"');
        expect(compiled.sql).toContain('"display_name" as "name"');
        expect(compiled.sql).toMatch(/order by "display_name" asc$/);
        expect(compiled.sql).not.toContain('originalQuery');
        expect(compiled.bindings).toEqual([7]);
        await knex.destroy();
    });
});
