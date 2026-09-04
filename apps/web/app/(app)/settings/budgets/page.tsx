import { BudgetSettings } from '@/components/budget-settings';
import { getApiClient, getCurrentUser } from '@/lib/api';

export default async function BudgetsPage() {
    const client = await getApiClient();
    const [me, currencies, archivedBudgets] = await Promise.all([
        getCurrentUser(),
        client.currencies.list(),
        client.budgets.list({ query: { status: 'archived' } })
    ]);

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
            />
        </div>
    );
}
