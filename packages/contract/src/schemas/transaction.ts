import { string, number, object } from '@cleverbrush/schema';

export const TransactionSchema = object({
  id: number(),
  userId: number(),
  categoryId: number(),
  amount: number(),
  currency: string(),
  description: string(),
  transactionDate: string(),
  createdAt: string(),
});

export const CreateTransactionBodySchema = object({
  categoryId: number(),
  amount: number(),
  currency: string(),
  description: string(),
  transactionDate: string(),
});

export const UpdateTransactionBodySchema = object({
  categoryId: number(),
  amount: number(),
  currency: string(),
  description: string(),
  transactionDate: string(),
});

export const TransactionListQuerySchema = object({
  page: number(),
  limit: number(),
  categoryId: number(),
  type: string(),
  startDate: string(),
  endDate: string(),
});
