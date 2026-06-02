type ReportCategoryType = 'expense' | 'income';

export type ReportCategoryTreeCategory = {
    readonly categoryId: number;
    readonly categoryName: string;
    readonly categoryDisplayName: string;
    readonly categoryParentId: number | null;
    readonly categoryParentName?: string;
    readonly categoryKind: 'normal' | 'offset';
    readonly type: ReportCategoryType;
};

export type ReportCategoryNode<T extends ReportCategoryTreeCategory> = {
    readonly category: T;
    readonly children: readonly T[];
};

function parentNameFor<T extends ReportCategoryTreeCategory>(
    children: readonly T[],
    fallback?: T
): string {
    const first = children[0];
    return (
        fallback?.categoryName ??
        first?.categoryParentName ??
        first?.categoryDisplayName.split(' -> ')[0] ??
        ''
    );
}

function normalizeParentCategory<T extends ReportCategoryTreeCategory>(
    category: T,
    parentId: number,
    parentName: string
): T {
    return {
        ...category,
        categoryDisplayName: parentName,
        categoryId: parentId,
        categoryKind: 'normal',
        categoryName: parentName,
        categoryParentId: null,
        categoryParentName: undefined
    };
}

export function buildReportCategoryNodes<T extends ReportCategoryTreeCategory>({
    categories,
    createParentCategory,
    parentCategories,
    type
}: {
    readonly categories: readonly T[];
    readonly createParentCategory: (
        parentId: number,
        categories: readonly T[],
        type: ReportCategoryType,
        parentName: string
    ) => T;
    readonly parentCategories: readonly T[];
    readonly type: ReportCategoryType;
}): ReportCategoryNode<T>[] {
    const leafCategories = categories.filter(
        category => category.type === type
    );
    const directCategoriesById = new Map<number, T>();
    const childCategoryIds = new Set<number>();
    const childrenByParentId = new Map<number, T[]>();

    for (const category of leafCategories) {
        if (category.categoryParentId === null) {
            directCategoriesById.set(category.categoryId, category);
            continue;
        }

        childCategoryIds.add(category.categoryId);
        const children =
            childrenByParentId.get(category.categoryParentId) ?? [];
        children.push(category);
        childrenByParentId.set(category.categoryParentId, children);
    }

    const parentCategoriesById = new Map<number, T>();
    for (const category of parentCategories) {
        if (category.type !== type) {
            continue;
        }
        if (
            childCategoryIds.has(category.categoryId) &&
            !childrenByParentId.has(category.categoryId) &&
            !directCategoriesById.has(category.categoryId)
        ) {
            continue;
        }

        parentCategoriesById.set(category.categoryId, category);
    }

    const representedParentIds = new Set<number>();
    const nodes: ReportCategoryNode<T>[] = [];

    for (const parent of parentCategoriesById.values()) {
        const parentId = parent.categoryId;
        const children = childrenByParentId.get(parentId) ?? [];
        const directCategory = directCategoriesById.get(parentId);
        const childRows =
            children.length > 0 && directCategory
                ? [directCategory, ...children]
                : children;
        const parentName =
            children.length > 0
                ? parentNameFor(children, parent)
                : parent.categoryName;

        representedParentIds.add(parentId);
        nodes.push({
            category: normalizeParentCategory(parent, parentId, parentName),
            children: childRows
        });
    }

    for (const [parentId, children] of childrenByParentId) {
        if (representedParentIds.has(parentId)) {
            continue;
        }

        const directCategory = directCategoriesById.get(parentId);
        const categoryRows = directCategory
            ? [directCategory, ...children]
            : children;
        const parentName = parentNameFor(children, directCategory);

        representedParentIds.add(parentId);
        nodes.push({
            category: createParentCategory(
                parentId,
                categoryRows,
                type,
                parentName
            ),
            children: categoryRows
        });
    }

    for (const category of leafCategories) {
        if (
            category.categoryParentId === null &&
            !representedParentIds.has(category.categoryId)
        ) {
            nodes.push({ category, children: [] });
        }
    }

    return nodes;
}
