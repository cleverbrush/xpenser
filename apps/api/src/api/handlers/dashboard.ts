import { ActionResult, type Handler } from '@cleverbrush/server';
import { convertAmount } from '../../services/currency.js';
import type { GetDashboardSummaryEndpoint } from '../endpoints.js';

function getPeriodBounds(period: string): { start: Date; end: Date } {
  const now = new Date();
  const end = new Date(now.getFullYear(), now.getMonth(), now.getDate(), 23, 59, 59, 999);

  switch (period) {
    case 'week': {
      const day = now.getDay();
      const start = new Date(now);
      start.setDate(now.getDate() - ((day + 6) % 7));
      start.setHours(0, 0, 0, 0);
      return { start, end };
    }
    case 'month':
      return { start: new Date(now.getFullYear(), now.getMonth(), 1), end };
    case 'quarter': {
      const quarterStart = Math.floor(now.getMonth() / 3) * 3;
      return { start: new Date(now.getFullYear(), quarterStart, 1), end };
    }
    case 'year':
      return { start: new Date(now.getFullYear(), 0, 1), end };
    default:
      return { start: new Date(now.getFullYear(), now.getMonth(), 1), end };
  }
}

export const getDashboardSummaryHandler: Handler<typeof GetDashboardSummaryEndpoint> = async (
  ctx,
  { db },
) => {
  const userId = Number((ctx.principal as { claims: { sub: string } }).claims.sub);
  const period = (ctx.query as { period?: string }).period ?? 'month';
  const bounds = getPeriodBounds(period);

  const user = await db.users.projected('public').find(userId);
  const defaultCurrency = user?.defaultCurrency ?? 'USD';

  const transactions = await db.transactions
    .where((t) => t.userId, userId)
    .where((t) => t.transactionDate, '>=', bounds.start)
    .where((t) => t.transactionDate, '<=', bounds.end)
    .include((t) => t.category)
    .orderBy((t) => t.transactionDate, 'desc')
    .all();

  const byCategory = new Map<
    number,
    { categoryId: number; categoryName: string; categoryType: string; total: number }
  >();
  let totalExpenses = 0;
  let totalIncome = 0;

  for (const tx of transactions) {
    const amount = await convertAmount(db, tx.amount, tx.currency, defaultCurrency);
    const type = (tx as { category?: { type?: string } }).category?.type ?? 'expense';

    if (type === 'income') {
      totalIncome += amount;
    } else {
      totalExpenses += amount;
    }

    const catId = tx.categoryId;
    const existing = byCategory.get(catId);
    if (existing) {
      existing.total += amount;
    } else {
      byCategory.set(catId, {
        categoryId: catId,
        categoryName: (tx as { category?: { name?: string } }).category?.name ?? 'Unknown',
        categoryType: type,
        total: amount,
      });
    }
  }

  return ActionResult.ok({
    totalExpenses: Math.round(totalExpenses * 100) / 100,
    totalIncome: Math.round(totalIncome * 100) / 100,
    netAmount: Math.round((totalIncome - totalExpenses) * 100) / 100,
    byCategory: Array.from(byCategory.values()),
    recentTransactions: transactions.slice(0, 10),
  });
};
