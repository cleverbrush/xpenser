import { getSession } from '../../../lib/auth';
import { client } from '../../../lib/api-client';
import { AmountDisplay, CategoryBadge } from '@xpenser/ui';

export default async function TransactionsPage() {
  const session = await getSession();

  let transactions: Record<string, unknown>[] = [];
  try {
    const result = await client.transactions.list({ query: { page: 1, limit: 50 } });
    if (Array.isArray(result)) transactions = result as unknown as typeof transactions;
  } catch {
    // Not available
  }

  return (
    <div className="space-y-6">
      <h2 className="text-2xl font-bold">Transactions</h2>

      {transactions.length === 0 ? (
        <div className="rounded-lg border bg-card p-12 text-center">
          <p className="text-muted-foreground">No transactions found. Add your first expense!</p>
        </div>
      ) : (
        <div className="rounded-lg border">
          <table className="w-full">
            <thead className="border-b bg-muted/50">
              <tr>
                <th className="px-4 py-3 text-left text-sm font-medium">Date</th>
                <th className="px-4 py-3 text-left text-sm font-medium">Description</th>
                <th className="px-4 py-3 text-left text-sm font-medium">Category</th>
                <th className="px-4 py-3 text-right text-sm font-medium">Amount</th>
              </tr>
            </thead>
            <tbody>
              {transactions.map((tx) => (
                <tr key={tx.id as number} className="border-b hover:bg-accent/50">
                  <td className="px-4 py-3 text-sm">{String(tx.transactionDate).slice(0, 10)}</td>
                  <td className="px-4 py-3 text-sm">{tx.description as string || '-'}</td>
                  <td className="px-4 py-3 text-sm">
                    <CategoryBadge
                      name={(tx as { category?: { name: string } }).category?.name ?? 'Unknown'}
                      type={(tx as { category?: { type: 'expense' | 'income' } }).category?.type ?? 'expense'}
                    />
                  </td>
                  <td className="px-4 py-3 text-sm text-right">
                    <AmountDisplay amount={tx.amount as number} currency={(tx.currency as string) || 'USD'} />
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}
