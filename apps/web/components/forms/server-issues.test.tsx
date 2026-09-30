/** @vitest-environment jsdom */
import {
    cleanup,
    fireEvent,
    render,
    screen,
    waitFor
} from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { ApiKeysSettings } from '../api-keys-settings';
import { BudgetMemberForm } from './budget-forms';
import { CategorySetupForm } from './category-setup-form';

const mocks = vi.hoisted(() => ({
    create: vi.fn(),
    invite: vi.fn(),
    key: vi.fn(),
    refresh: vi.fn(),
    push: vi.fn()
}));
vi.mock('next/navigation', () => ({
    useRouter: () => ({ refresh: mocks.refresh, push: mocks.push })
}));
vi.mock('@/lib/actions', () => ({
    createCategoryAction: mocks.create,
    inviteBudgetMemberAction: mocks.invite,
    createApiKeyAction: mocks.key,
    createBudgetAction: vi.fn(),
    updateBudgetAction: vi.fn(),
    updateBudgetMemberAction: vi.fn(),
    acceptBudgetInvitationAction: vi.fn(),
    revokeApiKeyAction: vi.fn(),
    revokeMcpOAuthConnectionAction: vi.fn()
}));
afterEach(() => {
    cleanup();
    vi.resetAllMocks();
});
const rejected = (pointer: string) => ({
    ok: false,
    error: 'Please check your input.',
    issues: [{ pointer, detail: 'Rejected by server' }]
});

describe('server issues on custom data-entry forms', () => {
    it('keeps setup rows and retries only categories not already saved', async () => {
        mocks.create
            .mockResolvedValueOnce({ ok: true, data: { id: 1 } })
            .mockResolvedValueOnce(rejected('/name'))
            .mockResolvedValueOnce({ ok: true, data: { id: 2 } });
        render(<CategorySetupForm />);
        fireEvent.change(screen.getByLabelText('Category 1 name'), {
            target: { value: 'Groceries' }
        });
        fireEvent.change(screen.getByLabelText('Category 2 name'), {
            target: { value: 'Salary' }
        });
        fireEvent.click(
            screen.getByRole('button', { name: 'Create categories' })
        );
        await screen.findByText('Rejected by server');
        expect(mocks.push).not.toHaveBeenCalled();
        expect(
            (screen.getByLabelText('Category 1 name') as HTMLInputElement)
                .disabled
        ).toBe(true);
        expect(
            screen
                .getByLabelText('Category 2 name')
                .getAttribute('aria-invalid')
        ).toBe('true');
        fireEvent.change(screen.getByLabelText('Category 2 name'), {
            target: { value: 'Pay' }
        });
        expect(screen.queryByText('Rejected by server')).toBeNull();
        fireEvent.click(
            screen.getByRole('button', { name: 'Create categories' })
        );
        await waitFor(() =>
            expect(mocks.push).toHaveBeenCalledWith('/dashboard')
        );
        expect(mocks.create).toHaveBeenCalledTimes(3);
        expect(mocks.create.mock.calls[2]![0].get('name')).toBe('Pay');
    });

    it('binds nested permission issues, preserves email, and resets defaults after success', async () => {
        mocks.invite
            .mockResolvedValueOnce(
                rejected('/permissions/canCreateTransactions')
            )
            .mockResolvedValueOnce({ ok: true, data: undefined });
        render(<BudgetMemberForm budgetId={1} />);
        fireEvent.change(screen.getByLabelText('Invite email'), {
            target: { value: 'friend@example.com' }
        });
        fireEvent.click(screen.getByRole('button', { name: /^Invite$/ }));
        await screen.findByText('Rejected by server');
        expect(mocks.refresh).not.toHaveBeenCalled();
        expect(
            (screen.getByLabelText('Invite email') as HTMLInputElement).value
        ).toBe('friend@example.com');
        fireEvent.click(screen.getByLabelText('Add transactions'));
        expect(screen.queryByText('Rejected by server')).toBeNull();
        fireEvent.click(screen.getByRole('button', { name: /^Invite$/ }));
        await waitFor(() => expect(mocks.refresh).toHaveBeenCalledOnce());
        expect(
            (screen.getByLabelText('Invite email') as HTMLInputElement).value
        ).toBe('');
        expect(
            (screen.getByLabelText('Add transactions') as HTMLInputElement)
                .checked
        ).toBe(true);
    });

    it('keeps API-key input after rejection and clears its issue on edit', async () => {
        mocks.key.mockResolvedValueOnce(rejected('/name'));
        render(
            <ApiKeysSettings
                apiKeys={[]}
                mcpConnections={[]}
                mcpUrl="https://example.com/mcp"
            />
        );
        const input = screen.getByLabelText('Name');
        fireEvent.change(input, { target: { value: 'Laptop' } });
        fireEvent.click(screen.getByRole('button', { name: 'Create key' }));
        await screen.findByText('Rejected by server');
        expect((input as HTMLInputElement).value).toBe('Laptop');
        expect(input.getAttribute('aria-invalid')).toBe('true');
        expect(screen.queryByText('New API key')).toBeNull();
        fireEvent.change(input, { target: { value: 'Desktop' } });
        expect(screen.queryByText('Rejected by server')).toBeNull();
    });
});
