import { ActionResult, type Handler } from '@cleverbrush/server';
import type {
  ListCategoriesEndpoint,
  CreateCategoryEndpoint,
  UpdateCategoryEndpoint,
  DeleteCategoryEndpoint,
} from '../endpoints.js';

function getUserId(ctx: { principal?: { claims?: { sub?: string } } }): number {
  const sub = ctx.principal?.claims?.sub;
  if (!sub) throw new Error('Not authenticated');
  return Number(sub);
}

export const listCategoriesHandler: Handler<typeof ListCategoriesEndpoint> = async (
  ctx,
  { db },
) => {
  const userId = getUserId(ctx);
  const categories = await db.categories
    .where((t) => t.userId, userId)
    .orderBy((t) => t.name)
    .first();
  return ActionResult.ok(categories ?? []);
};

export const createCategoryHandler: Handler<typeof CreateCategoryEndpoint> = async (
  ctx,
  { db },
) => {
  const userId = getUserId(ctx);
  const category = await db.categories.insert({
    userId,
    name: ctx.body.name,
    type: ctx.body.type,
  });
  return ActionResult.created(category);
};

export const updateCategoryHandler: Handler<typeof UpdateCategoryEndpoint> = async (
  ctx,
  { db },
) => {
  const userId = getUserId(ctx);
  const category = await db.categories.find(ctx.params.id);

  if (!category) {
    return ActionResult.notFound({ message: 'Category not found.' });
  }
  if (category.userId !== userId) {
    return ActionResult.forbidden({ message: 'Access denied.' });
  }

  if (ctx.body.name !== undefined) category.name = ctx.body.name;
  if (ctx.body.type !== undefined) category.type = ctx.body.type;

  await db.saveChanges();
  return ActionResult.ok(category);
};

export const deleteCategoryHandler: Handler<typeof DeleteCategoryEndpoint> = async (
  ctx,
  { db },
) => {
  const userId = getUserId(ctx);
  const category = await db.categories.find(ctx.params.id);

  if (!category) {
    return ActionResult.notFound({ message: 'Category not found.' });
  }
  if (category.userId !== userId) {
    return ActionResult.forbidden({ message: 'Access denied.' });
  }

  await db.categories.remove(ctx.params.id);
  await db.saveChanges();
  return ActionResult.noContent();
};
