import type { DashboardSummary } from '@xpenser/contracts';

type DashboardCategory = DashboardSummary['byCategory'][number];

export function dashboardCategoryShare(
    summary: DashboardSummary,
    category: DashboardCategory
): number {
    const basis =
        category.type === 'income' ? summary.incomeTotal : summary.expenseTotal;

    if (basis <= 0) {
        return 0;
    }

    const share = (category.total / basis) * 100;
    return Math.max(0, Math.min(100, share));
}
