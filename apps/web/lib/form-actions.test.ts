import { ApiError } from '@cleverbrush/client';
import { beforeEach, describe, expect, it, vi } from 'vitest';

const mocks = vi.hoisted(() => {
    const fn = () => vi.fn();
    return {
        client: {
            auth: {
                login: fn(),
                register: fn(),
                resendEmailConfirmation: fn()
            },
            vendors: { create: fn(), update: fn() },
            categories: { create: fn(), update: fn(), moveAndDelete: fn() },
            transactions: { create: fn(), update: fn() },
            transactionScans: { uploadImage: fn(), decide: fn() },
            budgets: {
                create: fn(),
                update: fn(),
                invite: fn(),
                updateMember: fn(),
                acceptInvitation: fn()
            },
            users: {
                updatePreferences: fn(),
                createApiKey: fn(),
                updateAvatar: fn()
            }
        },
        revalidate: fn(),
        redirect: fn(),
        cookieSet: fn()
    };
});
vi.mock('./api', () => ({
    getApiClient: async () => mocks.client,
    getAnonymousApiClient: () => mocks.client,
    getSessionOrRedirect: async () => ({ user: { id: '1' } })
}));
vi.mock('./budgets', () => ({
    selectedBudgetIdFromCookie: async () => 4,
    selectedBudgetCookie: 'budget'
}));
const scanUploads = vi.hoisted(() => ({ read: vi.fn(), remove: vi.fn() }));
vi.mock('./transaction-scan-upload-store', () => ({
    readScanUploadAttachment: scanUploads.read,
    deleteScanUpload: scanUploads.remove
}));
vi.mock('./config', () => ({
    webConfig: { appUrl: 'https://example.com', singleUser: { enabled: false } }
}));
vi.mock('./logger', () => ({
    loggerFor: () => ({ warn: vi.fn(), info: vi.fn() })
}));
vi.mock('next/cache', () => ({ revalidatePath: mocks.revalidate }));
vi.mock('next/headers', () => ({
    cookies: async () => ({ set: mocks.cookieSet })
}));
vi.mock('next/navigation', () => ({ redirect: mocks.redirect }));

import * as actions from './actions';

function data() {
    const result = new FormData();
    for (const [key, value] of Object.entries({
        id: '1',
        budgetId: '4',
        userId: '2',
        name: 'Valid name',
        type: 'expense',
        defaultCurrency: 'USD',
        email: 'valid@example.com',
        password: 'validPassword123',
        confirmPassword: 'validPassword123',
        countryCode: 'US',
        role: 'member',
        categoryId: '1',
        amount: '12.34',
        currency: 'USD',
        occurredAt: '2026-09-30T12:00:00Z',
        replacementCategoryId: '2',
        token: 'invitation-token'
    }))
        result.set(key, value);
    return result;
}

beforeEach(() => vi.clearAllMocks());

describe('form actions preserve server field errors', () => {
    it('forwards the active form budget and retry key without putting metadata in the body', async () => {
        const form = data();
        form.set('budgetId', '8');
        form.set('idempotencyKey', 'active-save');
        mocks.client.transactions.create.mockResolvedValueOnce({ id: 1 });
        expect((await actions.createCaptureTransactionAction(form)).ok).toBe(
            true
        );
        const request = mocks.client.transactions.create.mock.calls[0]![0];
        expect(request.headers).toEqual({ 'x-idempotency-key': 'active-save' });
        expect(request.body.budgetId).toBe(8);
        expect(request.body).not.toHaveProperty('idempotencyKey');
    });

    it.each([
        [
            409,
            'The previous save could not be confirmed. Check your transaction list before saving again.'
        ],
        [503, 'Saving is temporarily unavailable. Please try again shortly.']
    ])('shows the transaction recovery message for HTTP %s', async (status, message) => {
        mocks.client.transactions.create.mockRejectedValueOnce(
            new ApiError(Number(status), 'Problem', {
                title: 'Replay unavailable'
            })
        );
        expect(
            await actions.createCaptureTransactionAction(data())
        ).toMatchObject({ ok: false, error: message });
        expect(mocks.revalidate).not.toHaveBeenCalled();
    });

    it.each([
        'upload',
        'decision'
    ])('keeps the temporary receipt after a failed %s and sends only JSON decisions', async failure => {
        const image = {
            filename: 'receipt.png',
            buffer: Buffer.from('receipt'),
            size: 7,
            mimeType: 'image/png'
        };
        scanUploads.read.mockResolvedValue(image);
        mocks.client.transactionScans[
            failure === 'upload' ? 'uploadImage' : 'decide'
        ].mockRejectedValueOnce(
            new ApiError(400, 'Rejected', { message: 'Try again' })
        );
        const args = {
            scanId: 1,
            itemId: 2,
            body: {
                decision: 'confirmed' as const,
                transactionId: 9,
                attachment: { uploadId: 'upload' }
            }
        };
        expect(
            (await actions.recordTransactionScanDecisionAction(args)).ok
        ).toBe(false);
        expect(scanUploads.remove).not.toHaveBeenCalled();
        expect(
            (await actions.recordTransactionScanDecisionAction(args)).ok
        ).toBe(true);
        expect(
            mocks.client.transactionScans.uploadImage
        ).toHaveBeenLastCalledWith({ params: { scanId: 1 }, files: { image } });
        expect(mocks.client.transactionScans.decide).toHaveBeenLastCalledWith({
            params: { scanId: 1, itemId: 2 },
            body: { decision: 'confirmed', transactionId: 9 }
        });
        expect(scanUploads.remove).toHaveBeenCalledWith('1', 'upload');
        expect(mocks.client.transactions.create).not.toHaveBeenCalled();
    });
    const cases = [
        [actions.loginAction, mocks.client.auth.login],
        [actions.registerAction, mocks.client.auth.register],
        [
            actions.resendEmailConfirmationAction,
            mocks.client.auth.resendEmailConfirmation
        ],
        [actions.createVendorAction, mocks.client.vendors.create],
        [actions.updateVendorAction, mocks.client.vendors.update],
        [actions.createCategoryAction, mocks.client.categories.create],
        [actions.updateCategoryAction, mocks.client.categories.update],
        [
            actions.moveAndDeleteCategoryAction,
            mocks.client.categories.moveAndDelete
        ],
        [actions.createTransactionAction, mocks.client.transactions.create],
        [
            actions.createCaptureTransactionAction,
            mocks.client.transactions.create
        ],
        [actions.updateTransactionAction, mocks.client.transactions.update],
        [actions.createBudgetAction, mocks.client.budgets.create],
        [actions.updateBudgetAction, mocks.client.budgets.update],
        [actions.inviteBudgetMemberAction, mocks.client.budgets.invite],
        [actions.updateBudgetMemberAction, mocks.client.budgets.updateMember],
        [
            actions.acceptBudgetInvitationAction,
            mocks.client.budgets.acceptInvitation
        ],
        [actions.updatePreferencesAction, mocks.client.users.updatePreferences],
        [actions.createApiKeyAction, mocks.client.users.createApiKey]
    ] as const;
    it.each(
        cases
    )('%s returns issues without success side effects', async (action, call) => {
        call.mockRejectedValueOnce(
            new ApiError(400, 'Invalid', {
                type: 'about:blank',
                title: 'Invalid request',
                status: 400,
                errors: [
                    { pointer: '/body/name', detail: 'Name rejected by server' }
                ]
            })
        );
        expect(await action(data())).toMatchObject({
            ok: false,
            issues: [{ pointer: '/name', detail: 'Name rejected by server' }]
        });
        expect(mocks.revalidate).not.toHaveBeenCalled();
        expect(mocks.redirect).not.toHaveBeenCalled();
        expect(mocks.cookieSet).not.toHaveBeenCalled();
    });

    it('returns missing-input issues before attempting a write', async () => {
        const input = data();
        input.delete('name');
        expect(await actions.createVendorAction(input)).toMatchObject({
            ok: false,
            issues: [{ pointer: '/name', detail: 'name is required' }]
        });
        expect(mocks.client.vendors.create).not.toHaveBeenCalled();
    });

    it('preserves the unverified-email login recovery', async () => {
        mocks.client.auth.login.mockRejectedValueOnce(
            new ApiError(403, 'Unverified')
        );
        expect(await actions.loginAction(data())).toMatchObject({
            ok: false,
            unverifiedEmail: 'valid@example.com'
        });
    });

    it('revalidates only after a successful category creation', async () => {
        mocks.client.categories.create.mockResolvedValueOnce({
            id: 10,
            name: 'Saved'
        });
        expect(await actions.createCategoryAction(data())).toEqual({
            ok: true,
            data: { id: 10, name: 'Saved' }
        });
        expect(mocks.revalidate).toHaveBeenCalledWith('/settings/categories');
    });
});
