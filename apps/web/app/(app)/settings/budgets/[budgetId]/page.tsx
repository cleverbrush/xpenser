import type { Budget, BudgetAccessRow } from '@xpenser/contracts';
import { notFound } from 'next/navigation';
import { BudgetDetailSettings } from '@/components/budget-settings';
import { getApiClient, getCurrentUser } from '@/lib/api';

type BudgetDetailPageProps = {
    readonly params: Promise<{ readonly budgetId: string }>;
};

type ApiClient = Awaited<ReturnType<typeof getApiClient>>;

async function loadBudgetAccessRows(
    client: ApiClient,
    budget: Budget
): Promise<BudgetAccessRow[]> {
    if (!budget.permissions.canManageMembers) {
        return [];
    }

    // Access includes members and invitations and supports archived budgets.
    return client.budgets.access({ params: { id: budget.id } });
}

export default async function BudgetDetailPage({
    params
}: BudgetDetailPageProps) {
    const { budgetId } = await params;
    const id = Number(budgetId);
    if (!Number.isSafeInteger(id) || id <= 0) {
        notFound();
    }

    const client = await getApiClient({ disableBatching: true });
    const [me, currencies, archivedBudgets] = await Promise.all([
        getCurrentUser(),
        client.currencies.list(),
        client.budgets.list({ query: { status: 'archived' } })
    ]);
    const budget = [...me.budgets, ...archivedBudgets].find(
        item => item.id === id
    );
    if (!budget) {
        notFound();
    }
    const accessRows = await loadBudgetAccessRows(client, budget);

    return (
        <div className="mx-auto flex max-w-5xl flex-col gap-5 sm:gap-6">
            <div>
                <h1 className="text-2xl font-semibold">{budget.name}</h1>
                <p className="text-sm text-muted-foreground">
                    Manage your label, budget currencies, lifecycle, and access.
                </p>
            </div>
            <BudgetDetailSettings
                accessRows={accessRows}
                budget={budget}
                currencies={currencies}
                currentUserId={me.id}
            />
        </div>
    );
}
