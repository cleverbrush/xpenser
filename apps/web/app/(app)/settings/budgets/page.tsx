import { BudgetSettings } from '@/components/budget-settings';
import { getApiClient } from '@/lib/api';

export default async function BudgetsPage() {
    const client = await getApiClient();
    const [me, currencies, archivedBudgets] = await Promise.all([
        client.auth.me(),
        client.currencies.list(),
        client.budgets.list({ query: { status: 'archived' } })
    ]);
    const memberEntries = await Promise.all(
        me.budgets
            .filter(budget => budget.permissions.canManageMembers)
            .map(async budget => [
                budget.id,
                await client.budgets.members({
                    params: { id: budget.id }
                })
            ])
    );
    const membersByBudget = Object.fromEntries(memberEntries);

    return (
        <div className="mx-auto flex max-w-5xl flex-col gap-5 sm:gap-6">
            <div>
                <h1 className="text-2xl font-semibold">Budgets</h1>
                <p className="text-sm text-muted-foreground">
                    Manage personal labels, currencies, sharing, and archived
                    budgets.
                </p>
            </div>
            <BudgetSettings
                archivedBudgets={archivedBudgets}
                budgets={me.budgets}
                currencies={currencies}
                currentUserId={me.id}
                membersByBudget={membersByBudget}
            />
        </div>
    );
}
