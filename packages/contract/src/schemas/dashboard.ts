import { string, number, object, array } from '@cleverbrush/schema';

export const DashboardQuerySchema = object({
  period: string(),
  startDate: string(),
  endDate: string(),
});

const CategoryTotalSchema = object({
  categoryId: number(),
  categoryName: string(),
  categoryType: string(),
  total: number(),
});

export const DashboardSummarySchema = object({
  totalExpenses: number(),
  totalIncome: number(),
  netAmount: number(),
  byCategory: array(CategoryTotalSchema),
  recentTransactions: array(string()),
});
