import type { Category, Transaction } from '@xpenser/contracts';

export function categoriesByRecentUse(
    categories: readonly Category[],
    transactions: readonly Pick<Transaction, 'categoryId'>[]
): Category[] {
    const originalIndex = new Map(
        categories.map((category, index) => [category.id, index] as const)
    );
    const usage = new Map<number, { count: number; firstSeen: number }>();

    transactions.forEach((transaction, index) => {
        const current = usage.get(transaction.categoryId) ?? {
            count: 0,
            firstSeen: index
        };
        usage.set(transaction.categoryId, {
            count: current.count + 1,
            firstSeen: Math.min(current.firstSeen, index)
        });
    });

    return [...categories].sort((left, right) => {
        const leftUsage = usage.get(left.id);
        const rightUsage = usage.get(right.id);
        const usageDelta = (rightUsage?.count ?? 0) - (leftUsage?.count ?? 0);

        if (usageDelta !== 0) {
            return usageDelta;
        }
        if (
            leftUsage &&
            rightUsage &&
            leftUsage.firstSeen !== rightUsage.firstSeen
        ) {
            return leftUsage.firstSeen - rightUsage.firstSeen;
        }
        if (leftUsage && !rightUsage) {
            return -1;
        }
        if (!leftUsage && rightUsage) {
            return 1;
        }

        return (
            (originalIndex.get(left.id) ?? 0) -
            (originalIndex.get(right.id) ?? 0)
        );
    });
}
