import { ActionResult, type Handler } from '@cleverbrush/server';
import { convertAmount } from '../../services/currency.js';
import type {
  ListTransactionsEndpoint,
  GetTransactionEndpoint,
  CreateTransactionEndpoint,
  UpdateTransactionEndpoint,
  DeleteTransactionEndpoint,
} from '../endpoints.js';

export const listTransactionsHandler: Handler<typeof ListTransactionsEndpoint> = async (
  ctx,
  { db },
) => {
  const userId = Number((ctx.principal as { claims: { sub: string } }).claims.sub);
  const { query } = ctx;
  const page = query.page ?? 1;
  const limit = query.limit ?? 20;

  let q = db.transactions.where((t) => t.userId, userId);

  if (query.categoryId) q = q.where((t) => t.categoryId, query.categoryId);
  if (query.startDate) q = q.where((t) => t.transactionDate, '>=', new Date(query.startDate));
  if (query.endDate) q = q.where((t) => t.transactionDate, '<=', new Date(query.endDate));

  const total = await q.count();
  const transactions = await q
    .include((t) => t.category)
    .orderBy((t) => t.transactionDate, 'desc')
    .skip((page - 1) * limit)
    .take(limit)
    .all();

  return ActionResult.ok(transactions);
};

export const getTransactionHandler: Handler<typeof GetTransactionEndpoint> = async (
  { params },
  { db },
) => {
  const userId = Number((ctx.principal as { claims: { sub: string } }).claims.sub);
  const transaction = await db.transactions
    .where((t) => t.id, params.id)
    .where((t) => t.userId, userId)
    .include((t) => t.category)
    .first();

  if (!transaction) {
    return ActionResult.notFound({ message: 'Transaction not found.' });
  }
  return ActionResult.ok(transaction);
};

export const createTransactionHandler: Handler<typeof CreateTransactionEndpoint> = async (
  { body },
  { db },
) => {
  const userId = Number((ctx.principal as { claims: { sub: string } }).claims.sub);

  const category = await db.categories.find(body.categoryId);
  if (!category || category.userId !== userId) {
    return ActionResult.badRequest({ message: 'Invalid category.' });
  }

  const transaction = await db.categories.insert({
    userId,
    categoryId: body.categoryId,
    amount: body.amount,
    currency: body.currency,
    description: body.description ?? null,
    transactionDate: body.transactionDate ? new Date(body.transactionDate) : new Date(),
  });

  return ActionResult.created(transaction);
};

export const updateTransactionHandler: Handler<typeof UpdateTransactionEndpoint> = async (
  { params, body },
  { db },
) => {
  const userId = Number((ctx.principal as { claims: { sub: string } }).claims.sub);
  const transaction = await db.transactions.find(params.id);

  if (!transaction) {
    return ActionResult.notFound({ message: 'Transaction not found.' });
  }
  if (transaction.userId !== userId) {
    return ActionResult.forbidden({ message: 'Access denied.' });
  }

  if (body.categoryId !== undefined) transaction.categoryId = body.categoryId;
  if (body.amount !== undefined) transaction.amount = body.amount;
  if (body.currency !== undefined) transaction.currency = body.currency;
  if (body.description !== undefined) transaction.description = body.description;
  if (body.transactionDate !== undefined) {
    transaction.transactionDate = new Date(body.transactionDate);
  }

  await db.saveChanges();
  return ActionResult.ok(transaction);
};

export const deleteTransactionHandler: Handler<typeof DeleteTransactionEndpoint> = async (
  { params },
  { db },
) => {
  const userId = Number((ctx.principal as { claims: { sub: string } }).claims.sub);
  const transaction = await db.transactions.find(params.id);

  if (!transaction) {
    return ActionResult.notFound({ message: 'Transaction not found.' });
  }
  if (transaction.userId !== userId) {
    return ActionResult.forbidden({ message: 'Access denied.' });
  }

  await db.transactions.remove(params.id);
  await db.saveChanges();
  return ActionResult.noContent();
};
