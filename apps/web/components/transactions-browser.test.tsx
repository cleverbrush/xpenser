/**
 * @vitest-environment jsdom
 */

import { render, screen } from '@testing-library/react';
import type {
    Category,
    Currency,
    Transaction,
    TransactionTag,
    Vendor
} from '@xpenser/contracts';
import { describe, expect, it, vi } from 'vitest';
import { TransactionsBrowser } from './transactions-browser';

const push = vi.fn();

vi.mock('next/navigation', () => ({
    usePathname: () => '/transactions',
    useRouter: () => ({ push }),
    useSearchParams: () => new URLSearchParams()
}));

vi.mock('@/lib/actions', () => ({
    deleteTransactionAction: vi.fn(),
    updateTransactionAction: vi.fn()
}));

const timestamp = new Date('2026-06-01T12:00:00.000Z');

const categories: Category[] = [
    {
        id: 7,
        budgetId: 1,
        name: 'Groceries',
        displayName: 'Groceries',
        type: 'expense',
        parentId: null,
        kind: 'normal',
        inUse: true,
        hasChildren: false,
        archivedAt: null,
        createdAt: timestamp,
        updatedAt: timestamp
    }
];

const currencies: Currency[] = [{ code: 'USD', name: 'US dollar' }];

function transaction(overrides: Partial<Transaction> = {}): Transaction {
    return {
        id: 42,
        budgetId: 1,
        categoryId: 7,
        vendorId: null,
        categoryName: 'Groceries',
        categoryDisplayName: 'Groceries',
        categoryParentId: null,
        categoryKind: 'normal',
        type: 'expense',
        amount: 12.34,
        currency: 'USD',
        defaultCurrencyAmount: 12.34,
        defaultCurrency: 'USD',
        exchangeRate: 1,
        exchangeRateDate: '2026-06-01',
        occurredAt: timestamp,
        tags: [],
        createdBy: {
            userId: 1,
            email: 'owner@example.com'
        },
        scanAttachment: null,
        createdAt: timestamp,
        updatedAt: timestamp,
        ...overrides
    };
}

function renderBrowser(items: readonly Transaction[]) {
    render(
        <TransactionsBrowser
            categories={categories}
            currencies={currencies}
            currentUserId={1}
            defaultCurrency="USD"
            favoriteCurrencies={[]}
            hasInitialFilters={false}
            vendors={[] as Vendor[]}
            transactionTags={[] as TransactionTag[]}
            initialResponse={{
                items,
                total: items.length,
                page: 1,
                limit: 50,
                hasMore: false
            }}
            transactionCurrencies={['USD']}
            timezone="UTC"
        />
    );
}

describe('TransactionsBrowser', () => {
    it('shows creator avatars only for transactions added by other users', () => {
        renderBrowser([
            transaction(),
            transaction({
                id: 43,
                createdBy: {
                    userId: 2,
                    email: 'teammate@example.com',
                    avatarUrl: '/app-api/users/2/avatar'
                }
            })
        ]);

        expect(screen.queryByText(/Added by/i)).toBeNull();
        expect(
            screen.queryByRole('img', { name: 'owner@example.com' })
        ).toBeNull();
        expect(
            screen.getAllByRole('img', { name: 'teammate@example.com' }).length
        ).toBe(2);
    });
});
