import { ActionResult, type Handler } from '@cleverbrush/server';
import {
    acceptBudgetInvitation,
    BudgetAccessError,
    BudgetInvitationInvalidError,
    BudgetMemberError,
    BudgetNotFoundError,
    BudgetPermissionError,
    createBudget,
    deleteBudget,
    inviteBudgetMember,
    listBudgetMembers,
    listBudgets,
    removeBudgetMember,
    updateBudget,
    updateBudgetMember
} from '../../application/budgets.js';
import type {
    AcceptBudgetInvitationEndpoint,
    CreateBudgetEndpoint,
    DeleteBudgetEndpoint,
    InviteBudgetMemberEndpoint,
    ListBudgetMembersEndpoint,
    ListBudgetsEndpoint,
    RemoveBudgetMemberEndpoint,
    UpdateBudgetEndpoint,
    UpdateBudgetMemberEndpoint
} from '../endpoints.js';

function budgetAccessResult(err: unknown) {
    if (err instanceof BudgetPermissionError) {
        return ActionResult.forbidden({ message: err.message });
    }
    if (
        err instanceof BudgetAccessError ||
        err instanceof BudgetNotFoundError
    ) {
        return ActionResult.notFound({ message: err.message });
    }
    if (err instanceof BudgetMemberError) {
        return ActionResult.badRequest({ message: err.message });
    }
    return undefined;
}

export const listBudgetsHandler: Handler<typeof ListBudgetsEndpoint> = async (
    { principal, query },
    { db }
) => {
    return listBudgets(db, principal.userId, query.status);
};

export const createBudgetHandler: Handler<typeof CreateBudgetEndpoint> = async (
    { body, principal },
    { db }
) => {
    try {
        return ActionResult.created(
            await createBudget(db, principal.userId, body)
        );
    } catch (err) {
        const result = budgetAccessResult(err);
        if (result) {
            return result;
        }
        throw err;
    }
};

export const updateBudgetHandler: Handler<typeof UpdateBudgetEndpoint> = async (
    { body, params, principal },
    { db }
) => {
    try {
        return await updateBudget(db, principal.userId, params.id, body);
    } catch (err) {
        const result = budgetAccessResult(err);
        if (result) {
            return result;
        }
        throw err;
    }
};

export const deleteBudgetHandler: Handler<typeof DeleteBudgetEndpoint> = async (
    { params, principal },
    { db }
) => {
    try {
        await deleteBudget(db, principal.userId, params.id);
        return ActionResult.noContent();
    } catch (err) {
        const result = budgetAccessResult(err);
        if (result) {
            return result;
        }
        throw err;
    }
};

export const listBudgetMembersHandler: Handler<
    typeof ListBudgetMembersEndpoint
> = async ({ params, principal }, { db }) => {
    try {
        return await listBudgetMembers(db, principal.userId, params.id);
    } catch (err) {
        const result = budgetAccessResult(err);
        if (result) {
            return result;
        }
        throw err;
    }
};

export const inviteBudgetMemberHandler: Handler<
    typeof InviteBudgetMemberEndpoint
> = async ({ body, params, principal }, { db, config }) => {
    try {
        return await inviteBudgetMember(
            db,
            config,
            principal.userId,
            params.id,
            body
        );
    } catch (err) {
        const result = budgetAccessResult(err);
        if (result) {
            return result;
        }
        throw err;
    }
};

export const updateBudgetMemberHandler: Handler<
    typeof UpdateBudgetMemberEndpoint
> = async ({ body, params, principal }, { db }) => {
    try {
        return await updateBudgetMember(
            db,
            principal.userId,
            params.budgetId,
            params.userId,
            body
        );
    } catch (err) {
        const result = budgetAccessResult(err);
        if (result) {
            return result;
        }
        throw err;
    }
};

export const removeBudgetMemberHandler: Handler<
    typeof RemoveBudgetMemberEndpoint
> = async ({ params, principal }, { db }) => {
    try {
        await removeBudgetMember(
            db,
            principal.userId,
            params.budgetId,
            params.userId
        );
        return ActionResult.noContent();
    } catch (err) {
        const result = budgetAccessResult(err);
        if (result) {
            return result;
        }
        throw err;
    }
};

export const acceptBudgetInvitationHandler: Handler<
    typeof AcceptBudgetInvitationEndpoint
> = async ({ body, principal }, { db }) => {
    try {
        return await acceptBudgetInvitation(
            db,
            principal.userId,
            body.token,
            body.name
        );
    } catch (err) {
        if (err instanceof BudgetInvitationInvalidError) {
            return ActionResult.badRequest({ message: err.message });
        }
        throw err;
    }
};
