import { mapper } from '@cleverbrush/mapper';
import {
    boolean,
    date,
    type InferType,
    number,
    object,
    string
} from '@cleverbrush/schema';
import type {
    Category,
    CategoryListQuery,
    CreateCategoryBody,
    UpdateCategoryBodySchema
} from '@xpenser/contracts';
import { CategorySchema } from '@xpenser/contracts';
import type { AppDb, CategoryDb, TransactionDb } from '../db/schemas.js';
import { requireBudgetPermission, resolveBudgetAccess } from './budgets.js';

export class CategoryHierarchyError extends Error {}
export class CategoryInUseError extends Error {}
export class CategoryNotFoundError extends Error {}
export class LastCategoryError extends Error {}

type UpdateCategoryBody = InferType<typeof UpdateCategoryBodySchema>;
type CategoryUsageTransaction = Pick<TransactionDb, 'categoryId'>;
type CategoryKind = 'normal' | 'offset';
type CategoryType = CategoryDb['type'];

const recentCategoryWindowMs = 30 * 24 * 60 * 60 * 1000;

function normalizeCategoryKind(kind?: string | null): CategoryKind {
    return kind === 'offset' ? 'offset' : 'normal';
}

export function oppositeCategoryType(type: CategoryType): CategoryType {
    return type === 'expense' ? 'income' : 'expense';
}

export function categoryReportingType(
    category?: Pick<CategoryDb, 'kind' | 'type'> | null,
    fallbackType: CategoryType = 'expense'
): CategoryType {
    const type = category?.type ?? fallbackType;
    return normalizeCategoryKind(category?.kind) === 'offset'
        ? oppositeCategoryType(type)
        : type;
}

export function categoryParent(
    category: Pick<CategoryDb, 'parentId'>,
    categoriesById: ReadonlyMap<number, CategoryDb>
): CategoryDb | undefined {
    return category.parentId
        ? categoriesById.get(category.parentId)
        : undefined;
}

export function categoryDisplayName(
    category: Pick<CategoryDb, 'name' | 'parentId'>,
    categoriesById: ReadonlyMap<number, CategoryDb>
): string {
    const parent = categoryParent(category, categoriesById);
    return parent ? `${parent.name} -> ${category.name}` : category.name;
}

export function categoryAvailableForTransactions(
    category: Pick<CategoryDb, 'archivedAt' | 'parentId'>,
    categoriesById: ReadonlyMap<number, CategoryDb>
): boolean {
    if (category.archivedAt) {
        return false;
    }

    const parent = categoryParent(category, categoriesById);
    return !parent?.archivedAt;
}

const CategoryMappingSourceSchema = object({
    id: number(),
    budgetId: number(),
    name: string(),
    type: string(),
    kind: string(),
    parentId: number().optional(),
    parentName: string().optional(),
    displayName: string(),
    inUse: boolean(),
    hasChildren: boolean(),
    archivedAt: date().optional(),
    createdAt: date(),
    updatedAt: date()
});

const mapCategoryDto = mapper()
    .configure(CategoryMappingSourceSchema, CategorySchema, mapping =>
        mapping
            .for(target => target.type)
            .compute(source =>
                source.type === 'income' ? 'income' : 'expense'
            )
            .for(target => target.kind)
            .compute(source => normalizeCategoryKind(source.kind))
            .for(target => target.parentId)
            .compute(source => source.parentId ?? null)
            .for(target => target.archivedAt)
            .compute(source => source.archivedAt ?? null)
    )
    .getMapper(CategoryMappingSourceSchema, CategorySchema);

async function mapCategory(
    row: CategoryDb,
    inUse: boolean,
    hasChildren: boolean,
    categoriesById: ReadonlyMap<number, CategoryDb>
): Promise<Category> {
    const parent = categoryParent(row, categoriesById);

    return mapCategoryDto({
        id: row.id,
        budgetId: row.budgetId,
        name: row.name,
        type: row.type,
        kind: row.kind,
        parentId: row.parentId ?? undefined,
        parentName: parent?.name,
        displayName: categoryDisplayName(row, categoriesById),
        inUse,
        hasChildren,
        archivedAt: row.archivedAt ?? undefined,
        createdAt: row.createdAt,
        updatedAt: row.updatedAt
    });
}

function compareCategories(
    categoriesById: ReadonlyMap<number, CategoryDb>,
    left: CategoryDb,
    right: CategoryDb
): number {
    const leftParent = categoryParent(left, categoriesById);
    const rightParent = categoryParent(right, categoriesById);
    const leftGroup = leftParent?.name ?? left.name;
    const rightGroup = rightParent?.name ?? right.name;

    return (
        left.type.localeCompare(right.type) ||
        leftGroup.localeCompare(rightGroup) ||
        Number(Boolean(left.parentId)) - Number(Boolean(right.parentId)) ||
        left.name.localeCompare(right.name)
    );
}

async function usedCategoryIds(
    db: AppDb,
    budgetId: number
): Promise<Set<number>> {
    const transactions = await db.transactions.where(
        transaction => transaction.budgetId,
        budgetId
    );

    return new Set(transactions.map(transaction => transaction.categoryId));
}

async function recentCategoryTransactions(
    db: AppDb,
    budgetId: number
): Promise<TransactionDb[]> {
    const now = new Date();
    const from = new Date(now.getTime() - recentCategoryWindowMs);

    return (await db.transactions
        .where(transaction => transaction.budgetId, budgetId)
        .where(transaction => transaction.occurredAt, '>=', from)
        .where(
            transaction => transaction.occurredAt,
            '<=',
            now
        )) as TransactionDb[];
}

export function categoriesByRecentTransactionCount<T extends { id: number }>(
    categories: readonly T[],
    transactions: readonly CategoryUsageTransaction[]
): T[] {
    const originalIndex = new Map(
        categories.map((category, index) => [category.id, index] as const)
    );
    const counts = new Map<number, number>();

    for (const transaction of transactions) {
        counts.set(
            transaction.categoryId,
            (counts.get(transaction.categoryId) ?? 0) + 1
        );
    }

    return [...categories].sort((left, right) => {
        const countDelta =
            (counts.get(right.id) ?? 0) - (counts.get(left.id) ?? 0);

        if (countDelta !== 0) {
            return countDelta;
        }

        return (
            (originalIndex.get(left.id) ?? 0) -
            (originalIndex.get(right.id) ?? 0)
        );
    });
}

async function getCategory(
    db: AppDb,
    userId: number,
    categoryId: number
): Promise<CategoryDb> {
    const category = await db.categories
        .where(candidate => candidate.id, categoryId)
        .first();
    if (!category) {
        throw new CategoryNotFoundError('Category was not found.');
    }
    await resolveBudgetAccess(db, userId, (category as CategoryDb).budgetId);
    return category as CategoryDb;
}

async function getCategoryInBudget(
    db: AppDb,
    budgetId: number,
    categoryId: number
): Promise<CategoryDb> {
    const category = await db.categories
        .where(candidate => candidate.id, categoryId)
        .where(candidate => candidate.budgetId, budgetId)
        .first();
    if (!category) {
        throw new CategoryNotFoundError('Category was not found.');
    }
    return category as CategoryDb;
}

async function categoryHasChildren(
    db: AppDb,
    budgetId: number,
    categoryId: number
): Promise<boolean> {
    const children = await db.categories
        .where(candidate => candidate.budgetId, budgetId)
        .where(candidate => candidate.parentId, categoryId)
        .limit(1);
    return children.length > 0;
}

async function validateCategoryStructure(
    db: AppDb,
    budgetId: number,
    body: {
        readonly type: 'expense' | 'income';
        readonly parentId?: number | null;
        readonly kind?: CategoryKind;
    },
    categoryId?: number
): Promise<void> {
    const parentId = body.parentId ?? null;
    const kind = body.kind ?? 'normal';

    if (!parentId) {
        if (kind === 'offset') {
            throw new CategoryHierarchyError(
                'Offset categories must be subcategories.'
            );
        }
        return;
    }

    if (parentId === categoryId) {
        throw new CategoryHierarchyError(
            'A category cannot be its own parent.'
        );
    }

    const parent = await getCategoryInBudget(db, budgetId, parentId);
    if (parent.parentId) {
        throw new CategoryHierarchyError(
            'Only one level of category nesting is supported.'
        );
    }
    if (parent.type !== body.type) {
        throw new CategoryHierarchyError(
            'Subcategory type must match its parent category.'
        );
    }
}

function hasStructuralChange(
    current: CategoryDb,
    body: UpdateCategoryBody
): boolean {
    return (
        (body.type !== undefined && body.type !== current.type) ||
        (body.kind !== undefined &&
            body.kind !== normalizeCategoryKind(current.kind)) ||
        (body.parentId !== undefined &&
            (body.parentId ?? null) !== (current.parentId ?? null))
    );
}

export async function listCategories(
    db: AppDb,
    userId: number,
    query: CategoryListQuery = {}
): Promise<Category[]> {
    const access = await resolveBudgetAccess(db, userId, query.budgetId);
    const [categories, inUse, recentTransactions] = await Promise.all([
        db.categories.where(category => category.budgetId, access.budget.id),
        usedCategoryIds(db, access.budget.id),
        query.sort === 'recent-transaction-count'
            ? recentCategoryTransactions(db, access.budget.id)
            : Promise.resolve([])
    ]);
    const categoryRows = categories as CategoryDb[];
    const categoriesById = new Map(
        categoryRows.map(category => [category.id, category] as const)
    );
    const childParentIds = new Set(
        categoryRows.flatMap(category =>
            category.parentId ? [category.parentId] : []
        )
    );
    const filteredCategories = query.activeOnly
        ? categoryRows.filter(category =>
              categoryAvailableForTransactions(category, categoriesById)
          )
        : categoryRows;
    const categoriesInDisplayOrder = [...filteredCategories].sort(
        (left, right) => compareCategories(categoriesById, left, right)
    );
    const orderedCategories =
        query.sort === 'recent-transaction-count'
            ? categoriesByRecentTransactionCount(
                  categoriesInDisplayOrder,
                  recentTransactions
              )
            : categoriesInDisplayOrder;

    return Promise.all(
        orderedCategories.map(category =>
            mapCategory(
                category,
                inUse.has(category.id),
                childParentIds.has(category.id),
                categoriesById
            )
        )
    );
}

export async function createCategory(
    db: AppDb,
    userId: number,
    body: CreateCategoryBody
): Promise<Category> {
    const access = await resolveBudgetAccess(db, userId, body.budgetId);
    requireBudgetPermission(access, 'canManageCategories');
    const parentId = body.parentId ?? null;
    const kind = body.kind ?? 'normal';
    await validateCategoryStructure(db, access.budget.id, {
        type: body.type,
        parentId,
        kind
    });

    const created = await db.categories.insert({
        budgetId: access.budget.id,
        userId,
        parentId: parentId ?? undefined,
        name: body.name.trim(),
        type: body.type,
        kind,
        archivedAt: null
    });

    const categories = (await db.categories.where(
        category => category.budgetId,
        access.budget.id
    )) as CategoryDb[];
    const categoriesById = new Map(
        categories.map(category => [category.id, category] as const)
    );

    return mapCategory(created as CategoryDb, false, false, categoriesById);
}

export async function updateCategory(
    db: AppDb,
    userId: number,
    categoryId: number,
    body: UpdateCategoryBody
): Promise<Category> {
    const current = await getCategory(db, userId, categoryId);
    const access = await resolveBudgetAccess(db, userId, current.budgetId);
    requireBudgetPermission(access, 'canManageCategories');
    const inUse = await usedCategoryIds(db, access.budget.id);
    const hasChildren = await categoryHasChildren(
        db,
        access.budget.id,
        categoryId
    );
    const structuralChange = hasStructuralChange(current, body);

    if (structuralChange && inUse.has(categoryId)) {
        throw new CategoryInUseError(
            'Category structure cannot be changed while transactions use it.'
        );
    }
    if (structuralChange && hasChildren) {
        throw new CategoryHierarchyError(
            'Category structure cannot be changed while it has subcategories.'
        );
    }

    const next = {
        type: body.type ?? current.type,
        parentId:
            body.parentId !== undefined
                ? body.parentId
                : (current.parentId ?? null),
        kind: body.kind ?? normalizeCategoryKind(current.kind)
    };

    await validateCategoryStructure(db, access.budget.id, next, categoryId);

    const update: {
        name?: string;
        type?: 'expense' | 'income';
        parentId?: number | null;
        kind?: CategoryKind;
        archivedAt?: Date | null;
        updatedAt: Date;
    } = { updatedAt: new Date() };
    if (body.name !== undefined) {
        update.name = body.name.trim();
    }
    if (body.type !== undefined) {
        update.type = body.type;
    }
    if (body.parentId !== undefined) {
        update.parentId = body.parentId ?? null;
    }
    if (body.kind !== undefined) {
        update.kind = body.kind;
    }
    if (body.archived !== undefined) {
        update.archivedAt = body.archived ? new Date() : null;
    }

    const [updated] = await db.categories
        .where(category => category.id, categoryId)
        .where(category => category.budgetId, access.budget.id)
        .update(update as never)
        .then(rows => rows as CategoryDb[]);

    if (!updated) {
        throw new CategoryNotFoundError('Category was not found.');
    }

    const categories = (await db.categories.where(
        category => category.budgetId,
        access.budget.id
    )) as CategoryDb[];
    const categoriesById = new Map(
        categories.map(category => [category.id, category] as const)
    );
    const childParentIds = new Set(
        categories.flatMap(category =>
            category.parentId ? [category.parentId] : []
        )
    );

    return mapCategory(
        updated,
        inUse.has(updated.id),
        childParentIds.has(updated.id),
        categoriesById
    );
}

export async function deleteCategory(
    db: AppDb,
    userId: number,
    categoryId: number
): Promise<void> {
    const source = await getCategory(db, userId, categoryId);
    const access = await resolveBudgetAccess(db, userId, source.budgetId);
    requireBudgetPermission(access, 'canManageCategories');

    const categories = (await db.categories.where(
        candidate => candidate.budgetId,
        access.budget.id
    )) as CategoryDb[];
    const categoriesById = new Map(
        categories.map(category => [category.id, category] as const)
    );
    if (categories.length <= 1) {
        throw new LastCategoryError('At least one category is required.');
    }

    if (!categoryAvailableForTransactions(source, categoriesById)) {
        throw new CategoryHierarchyError(
            'Category must be restored before it can be deleted.'
        );
    }

    if (await categoryHasChildren(db, access.budget.id, categoryId)) {
        throw new CategoryHierarchyError(
            'Category cannot be deleted while it has subcategories.'
        );
    }

    const usage = await db.transactions
        .where(transaction => transaction.categoryId, categoryId)
        .limit(1);
    if (usage.length > 0) {
        throw new CategoryInUseError(
            'Category cannot be deleted while transactions use it.'
        );
    }

    await db.categories
        .where(candidate => candidate.id, categoryId)
        .where(candidate => candidate.budgetId, access.budget.id)
        .delete();
}

export async function moveAndDeleteCategory(
    db: AppDb,
    userId: number,
    categoryId: number,
    replacementCategoryId: number
): Promise<void> {
    const source = await getCategory(db, userId, categoryId);
    const access = await resolveBudgetAccess(db, userId, source.budgetId);
    requireBudgetPermission(access, 'canManageCategories');
    const replacement = await getCategoryInBudget(
        db,
        access.budget.id,
        replacementCategoryId
    );

    if (source.id === replacement.id) {
        throw new CategoryHierarchyError(
            'Replacement category must be different from the deleted category.'
        );
    }

    const categories = (await db.categories.where(
        candidate => candidate.budgetId,
        access.budget.id
    )) as CategoryDb[];
    const categoriesById = new Map(
        categories.map(category => [category.id, category] as const)
    );
    if (categories.length <= 1) {
        throw new LastCategoryError('At least one category is required.');
    }

    if (!categoryAvailableForTransactions(source, categoriesById)) {
        throw new CategoryHierarchyError(
            'Category must be restored before it can be deleted.'
        );
    }

    if (!categoryAvailableForTransactions(replacement, categoriesById)) {
        throw new CategoryHierarchyError(
            'Replacement category must be active.'
        );
    }

    if (await categoryHasChildren(db, access.budget.id, categoryId)) {
        throw new CategoryHierarchyError(
            'Category cannot be deleted while it has subcategories.'
        );
    }

    if (categoryReportingType(source) !== categoryReportingType(replacement)) {
        throw new CategoryHierarchyError(
            'Replacement category must report in the same direction.'
        );
    }

    const now = new Date();
    await db.transaction(async trx => {
        await trx.transactions
            .where(transaction => transaction.budgetId, access.budget.id)
            .where(transaction => transaction.categoryId, categoryId)
            .update({
                categoryId: replacement.id,
                type: replacement.type,
                updatedAt: now
            });

        await trx.categories
            .where(candidate => candidate.id, categoryId)
            .where(candidate => candidate.budgetId, access.budget.id)
            .delete();
    });
}
