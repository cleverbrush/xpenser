import {
    ActionResult,
    errorMap,
    type Handler,
    implement
} from '@cleverbrush/server';
import { api } from '@xpenser/contracts';
import { expect, expectTypeOf, it } from 'vitest';
import type { Config } from '../config.js';
import type { AppDb } from '../db/schemas.js';
import { loginHandler } from './features/auth/handlers/login.js';
import { authScope } from './features/auth/scope.js';
import type { inviteBudgetMemberHandler } from './features/budgets/handlers/invite.js';
import { budgetsModule } from './features/budgets/index.js';
import { budgetsScope } from './features/budgets/scope.js';
import { transactionScanProgressHandler } from './features/transaction-scans/handlers/progress.js';
import { transactionScansScope } from './features/transaction-scans/scope.js';

it('preserves request and dependency inference across independently defined handlers', () => {
    type Request = Parameters<typeof inviteBudgetMemberHandler>[0];
    type Services = Parameters<typeof inviteBudgetMemberHandler>[1];
    expectTypeOf<Request>().not.toBeAny();
    expectTypeOf<Request['params']['id']>().toEqualTypeOf<number>();
    expectTypeOf<Request['body']['email']>().toEqualTypeOf<string>();
    expectTypeOf<Request['principal']['userId']>().toEqualTypeOf<number>();
    expectTypeOf<Services>().toEqualTypeOf<{ db: AppDb; config: Config }>();
    expectTypeOf<
        Parameters<Handler<typeof budgetsScope.endpoints.list>>[1]
    >().toEqualTypeOf<{ db: AppDb }>();
    expectTypeOf<
        Parameters<typeof transactionScanProgressHandler>[0]['signal']
    >().toEqualTypeOf<AbortSignal>();
});

// Compile-only examples: never execute invalid registration attempts in tests.
function rejectedConsumerExamples() {
    // @ts-expect-error other contract groups are still missing
    implement(api).use(budgetsModule).complete();
    // @ts-expect-error the same operation cannot be registered twice
    implement(api).use(budgetsModule, budgetsModule);
    // @ts-expect-error list is not a complete budgets implementation
    budgetsScope.withHandlers({ list: () => [] });
    const badStatus = errorMap().on(Error, () =>
        ActionResult.notFound({ message: 'Missing' })
    );
    authScope.pick('login').withHandlers({
        // @ts-expect-error login declares 200/401/403, not 404
        login: { handler: loginHandler, errors: badStatus }
    });
    const badBody = errorMap().on(Error, () =>
        ActionResult.unauthorized({ message: 1 })
    );
    authScope.pick('login').withHandlers({
        // @ts-expect-error a policy cannot change the declared response body
        login: { handler: loginHandler, errors: badBody }
    });
    transactionScansScope.pick('progress').withHandlers({
        // @ts-expect-error HTTP error policies do not apply to subscriptions
        progress: { handler: transactionScanProgressHandler, errors: badStatus }
    });
    const invalid: Handler<typeof authScope.endpoints.login> = (
        _request,
        services
    ) => {
        // @ts-expect-error per-operation services do not leak across features
        services.logger;
        return ActionResult.unauthorized({ message: 'No' });
    };
    void invalid;
}

it('keeps invalid consumer examples compile-only', () => {
    expect(rejectedConsumerExamples).toBeTypeOf('function');
});
