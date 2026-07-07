import type { Budget, UserPreference } from '@xpenser/contracts';
import { cookies } from 'next/headers';

export const selectedBudgetCookie = 'xpenser_selected_budget';

type BudgetSource = Pick<UserPreference, 'budgets' | 'mainBudgetId'>;

function parseBudgetId(value: string | undefined): number | undefined {
    if (!value) {
        return undefined;
    }
    const id = Number(value);
    return Number.isSafeInteger(id) && id > 0 ? id : undefined;
}

export async function selectedBudgetIdFromCookie(): Promise<
    number | undefined
> {
    const cookieStore = await cookies();
    return parseBudgetId(cookieStore.get(selectedBudgetCookie)?.value);
}

export async function selectedBudgetForUser(
    user: BudgetSource
): Promise<Budget | undefined> {
    const selectedBudgetId = await selectedBudgetIdFromCookie();
    return (
        user.budgets.find(budget => budget.id === selectedBudgetId) ??
        user.budgets.find(budget => budget.id === user.mainBudgetId) ??
        user.budgets[0]
    );
}

export async function selectedBudgetQuery(
    user: BudgetSource
): Promise<{ readonly budgetId?: number }> {
    const budget = await selectedBudgetForUser(user);
    return budget ? { budgetId: budget.id } : {};
}
