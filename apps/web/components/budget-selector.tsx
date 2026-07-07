'use client';

import type { Budget } from '@xpenser/contracts';
import { usePathname, useSearchParams } from 'next/navigation';
import { selectBudgetAction } from '@/lib/actions';

export function BudgetSelector({
    budgets,
    selectedBudgetId
}: {
    readonly budgets: readonly Budget[];
    readonly selectedBudgetId?: number;
}) {
    const pathname = usePathname();
    const searchParams = useSearchParams();
    if (budgets.length === 0) {
        return null;
    }

    const query = searchParams.toString();
    const returnTo = query ? `${pathname}?${query}` : pathname;

    return (
        <form action={selectBudgetAction} className="min-w-0">
            <input name="returnTo" type="hidden" value={returnTo} />
            <select
                aria-label="Active budget"
                className="h-8 max-w-40 rounded-md border bg-background px-2 text-sm text-foreground outline-none transition-colors hover:bg-muted focus-visible:ring-2 focus-visible:ring-ring"
                defaultValue={selectedBudgetId}
                name="budgetId"
                onChange={event => event.currentTarget.form?.requestSubmit()}
            >
                {budgets.map(budget => (
                    <option key={budget.id} value={budget.id}>
                        {budget.name}
                    </option>
                ))}
            </select>
            <noscript>
                <button className="sr-only" type="submit">
                    Switch budget
                </button>
            </noscript>
        </form>
    );
}
