import { getSession } from '../../lib/auth';
import { client } from '../../lib/api-client';
import { PeriodSelector, AmountDisplay, CategoryBadge } from '@xpenser/ui';

interface DashboardData {
  totalExpenses: number;
  totalIncome: number;
  netAmount: number;
  byCategory: { categoryId: number; categoryName: string; categoryType: string; total: number }[];
  recentTransactions: Record<string, unknown>[];
}

export default async function DashboardPage({
  searchParams,
}: {
  searchParams: Promise<{ period?: string }>;
}) {
  const params = await searchParams;
  const period = (params.period ?? 'month') as 'week' | 'month' | 'quarter' | 'year';

  let dashboard: DashboardData = {
    totalExpenses: 0,
    totalIncome: 0,
    netAmount: 0,
    byCategory: [],
    recentTransactions: [],
  };

  try {
    const result = await client.dashboard.getSummary({ query: { period } });
    if (result && typeof result === 'object' && 'totalExpenses' in result) {
      dashboard = result as unknown as DashboardData;
    }
  } catch {
    // Dashboard not available
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <h2 className="text-2xl font-bold">Dashboard</h2>
      </div>

      <div className="grid grid-cols-3 gap-4">
        <div className="rounded-lg border bg-card p-4">
          <p className="text-sm text-muted-foreground">Income</p>
          <AmountDisplay amount={dashboard.totalIncome} currency="USD" className="text-xl font-bold" />
        </div>
        <div className="rounded-lg border bg-card p-4">
          <p className="text-sm text-muted-foreground">Expenses</p>
          <AmountDisplay amount={dashboard.totalExpenses} currency="USD" className="text-xl font-bold" />
        </div>
        <div className="rounded-lg border bg-card p-4">
          <p className="text-sm text-muted-foreground">Net</p>
          <AmountDisplay amount={dashboard.netAmount} currency="USD" className="text-xl font-bold" />
        </div>
      </div>

      <div className="rounded-lg border bg-card p-4">
        <h3 className="mb-4 text-lg font-semibold">Category Breakdown</h3>
        {dashboard.byCategory.length === 0 ? (
          <p className="text-sm text-muted-foreground">No transactions this period.</p>
        ) : (
          <div className="space-y-2">
            {dashboard.byCategory.map((cat) => (
              <div key={cat.categoryId} className="flex items-center justify-between rounded-md p-2 hover:bg-accent">
                <CategoryBadge name={cat.categoryName} type={cat.categoryType === 'income' ? 'income' : 'expense'} />
                <AmountDisplay amount={cat.total} currency="USD" />
              </div>
            ))}
          </div>
        )}
      </div>

      <div className="rounded-lg border bg-card p-4">
        <h3 className="mb-4 text-lg font-semibold">Recent Transactions</h3>
        {dashboard.recentTransactions.length === 0 ? (
          <p className="text-sm text-muted-foreground">No transactions yet.</p>
        ) : (
          <div className="space-y-2">
            {dashboard.recentTransactions.map((tx) => (
              <div key={tx.id as number} className="flex items-center justify-between rounded-md p-2 hover:bg-accent">
                <div>
                  <p className="text-sm font-medium">{String(tx.description ?? 'Transaction')}</p>
                  <p className="text-xs text-muted-foreground">{String(tx.transactionDate ?? '')}</p>
                </div>
                <AmountDisplay amount={Number(tx.amount ?? 0)} currency={String(tx.currency ?? 'USD')} />
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
