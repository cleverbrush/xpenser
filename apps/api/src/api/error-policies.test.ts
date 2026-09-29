import { describe, expect, it } from 'vitest';
import { ApiKeyNotFoundError } from '../application/api-keys.js';
import {
    BudgetAccessError,
    BudgetInvitationInvalidError,
    BudgetMemberError,
    BudgetNotFoundError,
    BudgetPermissionError
} from '../application/budgets.js';
import {
    CategoryHierarchyError,
    CategoryInUseError,
    CategoryNotFoundError,
    LastCategoryError
} from '../application/categories.js';
import {
    McpOAuthConnectionNotFoundError,
    OAuthError
} from '../application/mcp-oauth.js';
import {
    TelegramAccountConflictError,
    TelegramAccountNotLinkedError,
    TelegramLinkTokenInvalidError,
    TelegramNotConfiguredError
} from '../application/telegram.js';
import {
    TransactionScanInputError,
    TransactionScanNotFoundError
} from '../application/transaction-scans.js';
import { TransactionTagError } from '../application/transaction-tags.js';
import {
    TransactionCategoryError,
    TransactionExportError,
    TransactionNotFoundError
} from '../application/transactions.js';
import { UserAvatarError } from '../application/user-avatars.js';
import {
    DuplicateEmailError,
    EmailNotVerifiedError,
    InvalidCredentialsError,
    InvalidEmailConfirmationTokenError,
    InvalidGoogleIdentityError,
    InvalidPassportIdentityError,
    PasswordMismatchError,
    SingleUserModeDisabledError
} from '../application/users.js';
import {
    VendorMetadataError,
    VendorNameError,
    VendorNotFoundError
} from '../application/vendors.js';
import { PassportAuthError } from '../security/passport.js';
import { budgetAccessErrors } from './errors/budget-access.js';
import * as authErrors from './features/auth/errors.js';
import * as budgetsErrors from './features/budgets/errors.js';
import * as categoriesErrors from './features/categories/errors.js';
import * as oauthErrors from './features/oauth/errors.js';
import * as statsErrors from './features/stats/errors.js';
import * as telegramErrors from './features/telegram/errors.js';
import * as transactionScansErrors from './features/transaction-scans/errors.js';
import * as transactionsErrors from './features/transactions/errors.js';
import * as usersErrors from './features/users/errors.js';
import * as vendorsErrors from './features/vendors/errors.js';

// Expected exception sets were captured from the previous handler catch blocks.
const exceptions = {
    DuplicateEmailError: {
        error: new DuplicateEmailError('Expected failure'),
        status: 400
    },
    PasswordMismatchError: {
        error: new PasswordMismatchError('Expected failure'),
        status: 400
    },
    InvalidCredentialsError: {
        error: new InvalidCredentialsError('Expected failure'),
        status: 401
    },
    EmailNotVerifiedError: {
        error: new EmailNotVerifiedError('Expected failure'),
        status: 403
    },
    InvalidEmailConfirmationTokenError: {
        error: new InvalidEmailConfirmationTokenError('Expected failure'),
        status: 400
    },
    InvalidGoogleIdentityError: {
        error: new InvalidGoogleIdentityError('Expected failure'),
        status: 400
    },
    InvalidPassportIdentityError: {
        error: new InvalidPassportIdentityError('Expected failure'),
        status: 400
    },
    PassportAuthError: {
        error: new PassportAuthError('Expected failure'),
        status: 401
    },
    SingleUserModeDisabledError: {
        error: new SingleUserModeDisabledError('Expected failure'),
        status: 404
    },
    TelegramNotConfiguredError: {
        error: new TelegramNotConfiguredError('Expected failure'),
        status: 400
    },
    UserAvatarError: {
        error: new UserAvatarError('Expected failure'),
        status: 400
    },
    ApiKeyNotFoundError: {
        error: new ApiKeyNotFoundError('Expected failure'),
        status: 404
    },
    McpOAuthConnectionNotFoundError: {
        error: new McpOAuthConnectionNotFoundError('Expected failure'),
        status: 404
    },
    BudgetPermissionError: {
        error: new BudgetPermissionError('Expected failure'),
        status: 403
    },
    BudgetAccessError: {
        error: new BudgetAccessError('Expected failure'),
        status: 404
    },
    BudgetNotFoundError: {
        error: new BudgetNotFoundError('Expected failure'),
        status: 404
    },
    BudgetMemberError: {
        error: new BudgetMemberError('Expected failure'),
        status: 400
    },
    BudgetInvitationInvalidError: {
        error: new BudgetInvitationInvalidError('Expected failure'),
        status: 400
    },
    OAuthError: {
        error: new OAuthError('invalid_request', 'Expected failure'),
        status: 400
    },
    TelegramLinkTokenInvalidError: {
        error: new TelegramLinkTokenInvalidError('Expected failure'),
        status: 400
    },
    TelegramAccountConflictError: {
        error: new TelegramAccountConflictError('Expected failure'),
        status: 409
    },
    TelegramAccountNotLinkedError: {
        error: new TelegramAccountNotLinkedError('Expected failure'),
        status: 401
    },
    CategoryHierarchyError: {
        error: new CategoryHierarchyError('Expected failure'),
        status: 400
    },
    CategoryNotFoundError: {
        error: new CategoryNotFoundError('Expected failure'),
        status: 404
    },
    CategoryInUseError: {
        error: new CategoryInUseError('Expected failure'),
        status: 400
    },
    LastCategoryError: {
        error: new LastCategoryError('Expected failure'),
        status: 400
    },
    VendorNotFoundError: {
        error: new VendorNotFoundError('Expected failure'),
        status: 404
    },
    VendorNameError: {
        error: new VendorNameError('Expected failure'),
        status: 400
    },
    VendorMetadataError: {
        error: new VendorMetadataError('Expected failure'),
        status: 400
    },
    TransactionExportError: {
        error: new TransactionExportError('Expected failure'),
        status: 400
    },
    TransactionTagError: {
        error: new TransactionTagError('Expected failure'),
        status: 400
    },
    TransactionCategoryError: {
        error: new TransactionCategoryError('Expected failure'),
        status: 400
    },
    TransactionNotFoundError: {
        error: new TransactionNotFoundError('Expected failure'),
        status: 404
    },
    TransactionScanInputError: {
        error: new TransactionScanInputError('Expected failure'),
        status: 400
    },
    TransactionScanNotFoundError: {
        error: new TransactionScanNotFoundError('Expected failure'),
        status: 404
    }
};
const policies = [
    {
        name: 'authErrors.registerErrors',
        policy: authErrors.registerErrors,
        handled: ['DuplicateEmailError', 'PasswordMismatchError']
    },
    {
        name: 'authErrors.loginErrors',
        policy: authErrors.loginErrors,
        handled: ['InvalidCredentialsError', 'EmailNotVerifiedError']
    },
    {
        name: 'authErrors.confirmEmailErrors',
        policy: authErrors.confirmEmailErrors,
        handled: ['InvalidEmailConfirmationTokenError']
    },
    {
        name: 'authErrors.passportResolveUserErrors',
        policy: authErrors.passportResolveUserErrors,
        handled: [
            'InvalidGoogleIdentityError',
            'InvalidPassportIdentityError',
            'PassportAuthError'
        ]
    },
    {
        name: 'authErrors.passportExchangeErrors',
        policy: authErrors.passportExchangeErrors,
        handled: ['PassportAuthError']
    },
    {
        name: 'authErrors.googleSignInErrors',
        policy: authErrors.googleSignInErrors,
        handled: ['InvalidGoogleIdentityError']
    },
    {
        name: 'authErrors.singleUserSessionTokenErrors',
        policy: authErrors.singleUserSessionTokenErrors,
        handled: ['SingleUserModeDisabledError']
    },
    {
        name: 'usersErrors.createTelegramLinkTokenErrors',
        policy: usersErrors.createTelegramLinkTokenErrors,
        handled: ['TelegramNotConfiguredError']
    },
    {
        name: 'usersErrors.updateAvatarErrors',
        policy: usersErrors.updateAvatarErrors,
        handled: ['UserAvatarError']
    },
    {
        name: 'usersErrors.revokeApiKeyErrors',
        policy: usersErrors.revokeApiKeyErrors,
        handled: ['ApiKeyNotFoundError']
    },
    {
        name: 'usersErrors.revokeMcpOAuthConnectionErrors',
        policy: usersErrors.revokeMcpOAuthConnectionErrors,
        handled: ['McpOAuthConnectionNotFoundError']
    },
    {
        name: 'budgetsErrors.budgetOperationErrors',
        policy: budgetsErrors.budgetOperationErrors,
        handled: [
            'BudgetPermissionError',
            'BudgetAccessError',
            'BudgetNotFoundError',
            'BudgetMemberError'
        ]
    },
    {
        name: 'budgetsErrors.acceptInvitationErrors',
        policy: budgetsErrors.acceptInvitationErrors,
        handled: ['BudgetInvitationInvalidError']
    },
    {
        name: 'oauthErrors.authorizationRequestErrors',
        policy: oauthErrors.authorizationRequestErrors,
        handled: ['OAuthError']
    },
    {
        name: 'telegramErrors.linkErrors',
        policy: telegramErrors.linkErrors,
        handled: [
            'TelegramLinkTokenInvalidError',
            'TelegramAccountConflictError'
        ]
    },
    {
        name: 'telegramErrors.tokenErrors',
        policy: telegramErrors.tokenErrors,
        handled: ['TelegramAccountNotLinkedError']
    },
    {
        name: 'budgetAccessErrors',
        policy: budgetAccessErrors,
        handled: ['BudgetPermissionError', 'BudgetAccessError']
    },
    {
        name: 'categoriesErrors.createErrors',
        policy: categoriesErrors.createErrors,
        handled: [
            'BudgetPermissionError',
            'BudgetAccessError',
            'CategoryHierarchyError'
        ]
    },
    {
        name: 'categoriesErrors.updateErrors',
        policy: categoriesErrors.updateErrors,
        handled: [
            'BudgetPermissionError',
            'BudgetAccessError',
            'CategoryNotFoundError',
            'CategoryHierarchyError',
            'CategoryInUseError'
        ]
    },
    {
        name: 'categoriesErrors.deleteErrors',
        policy: categoriesErrors.deleteErrors,
        handled: [
            'BudgetPermissionError',
            'BudgetAccessError',
            'CategoryNotFoundError',
            'CategoryInUseError',
            'CategoryHierarchyError',
            'LastCategoryError'
        ]
    },
    {
        name: 'categoriesErrors.moveAndDeleteErrors',
        policy: categoriesErrors.moveAndDeleteErrors,
        handled: [
            'BudgetPermissionError',
            'BudgetAccessError',
            'CategoryNotFoundError',
            'CategoryHierarchyError',
            'CategoryInUseError',
            'LastCategoryError'
        ]
    },
    {
        name: 'vendorsErrors.getErrors',
        policy: vendorsErrors.getErrors,
        handled: [
            'BudgetPermissionError',
            'BudgetAccessError',
            'VendorNotFoundError'
        ]
    },
    {
        name: 'vendorsErrors.createErrors',
        policy: vendorsErrors.createErrors,
        handled: [
            'BudgetPermissionError',
            'BudgetAccessError',
            'VendorNameError'
        ]
    },
    {
        name: 'vendorsErrors.updateErrors',
        policy: vendorsErrors.updateErrors,
        handled: [
            'BudgetPermissionError',
            'BudgetAccessError',
            'VendorNotFoundError',
            'VendorNameError',
            'VendorMetadataError'
        ]
    },
    {
        name: 'transactionsErrors.exportCsvErrors',
        policy: transactionsErrors.exportCsvErrors,
        handled: [
            'BudgetPermissionError',
            'BudgetAccessError',
            'TransactionExportError'
        ]
    },
    {
        name: 'transactionsErrors.createErrors',
        policy: transactionsErrors.createErrors,
        handled: [
            'BudgetPermissionError',
            'BudgetAccessError',
            'TransactionTagError',
            'TransactionCategoryError'
        ]
    },
    {
        name: 'transactionsErrors.updateErrors',
        policy: transactionsErrors.updateErrors,
        handled: [
            'BudgetPermissionError',
            'BudgetAccessError',
            'TransactionNotFoundError',
            'TransactionCategoryError',
            'TransactionTagError'
        ]
    },
    {
        name: 'transactionsErrors.deleteErrors',
        policy: transactionsErrors.deleteErrors,
        handled: [
            'BudgetPermissionError',
            'BudgetAccessError',
            'TransactionNotFoundError'
        ]
    },
    {
        name: 'transactionScansErrors.createErrors',
        policy: transactionScansErrors.createErrors,
        handled: [
            'BudgetPermissionError',
            'BudgetAccessError',
            'TransactionScanInputError'
        ]
    },
    {
        name: 'transactionScansErrors.decideErrors',
        policy: transactionScansErrors.decideErrors,
        handled: [
            'BudgetPermissionError',
            'BudgetAccessError',
            'TransactionScanInputError',
            'TransactionScanNotFoundError'
        ]
    },
    {
        name: 'statsErrors.categoryTrendErrors',
        policy: statsErrors.categoryTrendErrors,
        handled: [
            'BudgetPermissionError',
            'BudgetAccessError',
            'TransactionCategoryError'
        ]
    }
] as const;

describe.each(policies)('$name', ({ policy, handled }) => {
    for (const [name, { error, status }] of Object.entries(exceptions)) {
        it('preserves handling of ' + name, async () => {
            if ((handled as readonly string[]).includes(name)) {
                await expect(policy.translate(error)).resolves.toMatchObject({
                    status,
                    body: { message: error.message }
                });
            } else {
                await expect(policy.translate(error)).rejects.toBe(error);
            }
        });
    }
    it('rethrows unknown failures without exposing them as expected responses', async () => {
        const failure = new Error('Private infrastructure details');
        await expect(policy.translate(failure)).rejects.toBe(failure);
        await expect(policy.translate('non-Error failure')).rejects.toBe(
            'non-Error failure'
        );
    });
});
