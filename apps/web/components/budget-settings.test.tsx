/**
 * @vitest-environment jsdom
 */

import { render, screen } from '@testing-library/react';
import type { Budget, BudgetMember, Currency } from '@xpenser/contracts';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { BudgetDetailSettings, BudgetSettings } from './budget-settings';

const archiveBudgetAction = vi.fn();
const createBudgetAction = vi.fn();
const deleteBudgetAction = vi.fn();
const inviteBudgetMemberAction = vi.fn();
const removeBudgetMemberAction = vi.fn();
const restoreBudgetAction = vi.fn();
const updateBudgetAction = vi.fn();
const updateBudgetMemberAction = vi.fn();

vi.mock('@/lib/actions', () => ({
    archiveBudgetAction: (formData: FormData) => archiveBudgetAction(formData),
    createBudgetAction: (formData: FormData) => createBudgetAction(formData),
    deleteBudgetAction: (formData: FormData) => deleteBudgetAction(formData),
    inviteBudgetMemberAction: (formData: FormData) =>
        inviteBudgetMemberAction(formData),
    removeBudgetMemberAction: (formData: FormData) =>
        removeBudgetMemberAction(formData),
    restoreBudgetAction: (formData: FormData) => restoreBudgetAction(formData),
    updateBudgetAction: (formData: FormData) => updateBudgetAction(formData),
    updateBudgetMemberAction: (formData: FormData) =>
        updateBudgetMemberAction(formData)
}));

const timestamp = new Date('2026-06-01T00:00:00.000Z');
const currencies: Currency[] = [
    { code: 'USD', name: 'US dollar' },
    { code: 'EUR', name: 'Euro' }
];

function budget(overrides: Partial<Budget> = {}): Budget {
    return {
        id: 1,
        name: 'Main',
        defaultCurrency: 'USD',
        favoriteCurrencies: [],
        transactionCurrencies: ['USD'],
        countryCode: 'US',
        role: 'admin',
        permissions: {
            canCreateTransactions: true,
            canUpdateTransactions: true,
            canDeleteTransactions: true,
            canManageCategories: true,
            canManageVendors: true,
            canManageTags: true,
            canManageMembers: true
        },
        isMain: true,
        archivedAt: null,
        createdAt: timestamp,
        updatedAt: timestamp,
        ...overrides
    };
}

function member(overrides: Partial<BudgetMember> = {}): BudgetMember {
    return {
        budgetId: 1,
        userId: 1,
        email: 'owner@example.com',
        user: {
            userId: 1,
            email: 'owner@example.com',
            displayName: 'Owner'
        },
        role: 'admin',
        permissions: {
            canCreateTransactions: true,
            canUpdateTransactions: true,
            canDeleteTransactions: true,
            canManageCategories: true,
            canManageVendors: true,
            canManageTags: true,
            canManageMembers: true
        },
        createdAt: timestamp,
        updatedAt: timestamp,
        ...overrides
    };
}

function renderSettings({
    activeBudgets = [budget()],
    archivedBudgets = []
}: {
    readonly activeBudgets?: readonly Budget[];
    readonly archivedBudgets?: readonly Budget[];
} = {}) {
    return render(
        <BudgetSettings
            archivedBudgets={archivedBudgets}
            budgets={activeBudgets}
            currencies={currencies}
        />
    );
}

function renderDetail(selectedBudget = budget(), rows = [member()]) {
    return render(
        <BudgetDetailSettings
            accessRows={rows.map(row => ({
                status: 'active' as const,
                ...row
            }))}
            budget={selectedBudget}
            currencies={currencies}
            currentUserId={1}
        />
    );
}

describe('BudgetSettings', () => {
    afterEach(() => {
        archiveBudgetAction.mockReset();
        createBudgetAction.mockReset();
        deleteBudgetAction.mockReset();
        inviteBudgetMemberAction.mockReset();
        removeBudgetMemberAction.mockReset();
        restoreBudgetAction.mockReset();
        updateBudgetAction.mockReset();
        updateBudgetMemberAction.mockReset();
    });

    it('creates budgets from name and budget currencies only', () => {
        renderSettings();

        expect(screen.getByPlaceholderText('Shared household')).toBeTruthy();
        expect(screen.getAllByText('Primary').length).toBeGreaterThan(0);
        expect(
            screen.getAllByText('Favorite currencies').length
        ).toBeGreaterThan(0);
        expect(screen.queryByLabelText('Country')).toBeNull();
    });

    it('lets admins invite members to Main with a personal budget name', () => {
        renderDetail();

        expect(screen.getByLabelText('Invite email')).toBeTruthy();
        expect(screen.getByRole('button', { name: 'Invite' })).toBeTruthy();
        expect(screen.getByText('owner@example.com')).toBeTruthy();
        expect(screen.getByText('Active')).toBeTruthy();
    });

    it('shows archive controls for active budgets and restore/delete for archived budgets', () => {
        renderDetail(
            budget({
                id: 2,
                isMain: false,
                name: 'Travel'
            })
        );

        expect(screen.getByRole('button', { name: 'Archive' })).toBeTruthy();
    });

    it('shows restore/delete for archived budget details', () => {
        renderDetail(
            budget({
                archivedAt: new Date('2026-06-02T00:00:00.000Z'),
                id: 3,
                isMain: false,
                name: 'Old travel'
            })
        );

        expect(screen.getByRole('button', { name: 'Restore' })).toBeTruthy();
        expect(screen.getByRole('button', { name: 'Delete' })).toBeTruthy();
    });
});
