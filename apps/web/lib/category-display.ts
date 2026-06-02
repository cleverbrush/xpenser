import type { Category } from '@xpenser/contracts';

export type CategoryDirection = Category['type'];

type CategoryDirectionInput = Pick<Category, 'kind' | 'type'>;
type CategoryTreeInput = Pick<Category, 'id' | 'parentId'>;
type CategoryAvailabilityInput = Pick<
    Category,
    'archivedAt' | 'id' | 'parentId'
>;

export function oppositeCategoryDirection(
    type: CategoryDirection
): CategoryDirection {
    return type === 'expense' ? 'income' : 'expense';
}

export function categoryEffectiveType(
    category: CategoryDirectionInput
): CategoryDirection {
    return category.kind === 'offset'
        ? oppositeCategoryDirection(category.type)
        : category.type;
}

export function categoryTypeLabel(type: CategoryDirection): string {
    return type === 'expense' ? 'Expense' : 'Income';
}

export function categoryArchived(
    category: Pick<Category, 'archivedAt'>
): boolean {
    return Boolean(category.archivedAt);
}

export function categoryAvailableForTransactions<
    T extends CategoryAvailabilityInput
>(category: T, categories: readonly T[]): boolean {
    if (categoryArchived(category)) {
        return false;
    }

    const parent = category.parentId
        ? categories.find(candidate => candidate.id === category.parentId)
        : undefined;

    return !parent?.archivedAt;
}

export function transactionCategoryOptions<T extends CategoryAvailabilityInput>(
    categories: readonly T[],
    includeCategoryId?: number
): T[] {
    return categories.filter(
        category =>
            categoryAvailableForTransactions(category, categories) ||
            category.id === includeCategoryId
    );
}

export type CategoryTreeNode<T extends CategoryTreeInput> = {
    readonly category: T;
    readonly children: readonly T[];
};

export function categoryTree<T extends CategoryTreeInput>(
    categories: readonly T[]
): CategoryTreeNode<T>[] {
    const categoriesById = new Map(
        categories.map(category => [category.id, category] as const)
    );
    const childrenByParentId = new Map<number, T[]>();

    for (const category of categories) {
        if (
            category.parentId === null ||
            !categoriesById.has(category.parentId)
        ) {
            continue;
        }

        const children = childrenByParentId.get(category.parentId) ?? [];
        children.push(category);
        childrenByParentId.set(category.parentId, children);
    }

    return categories
        .filter(
            category =>
                category.parentId === null ||
                !categoriesById.has(category.parentId)
        )
        .map(category => ({
            category,
            children: childrenByParentId.get(category.id) ?? []
        }));
}
