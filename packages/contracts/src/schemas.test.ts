import { describe, expect, it } from 'vitest';
import { FieldLimits, TransactionTagLimits } from './limits.js';
import {
    CategoryListQuerySchema,
    CategorySchema,
    CategoryTrendQuerySchema,
    ConfirmEmailBodySchema,
    CreateApiKeyBodySchema,
    CreateCategoryBodySchema,
    CreateTransactionBodySchema,
    CreateVendorBodySchema,
    CurrencyCodeSchema,
    CurrencyConversionQuerySchema,
    DashboardSummarySchema,
    DashboardWindowQuerySchema,
    EmailConfirmationPendingResponseSchema,
    GoogleSignInBodySchema,
    LinkTelegramAccountBodySchema,
    LoginBodySchema,
    MoveAndDeleteCategoryBodySchema,
    PassportExchangeBodySchema,
    PassportResolveUserBodySchema,
    PeriodWindowQuerySchema,
    RegisterBodySchema,
    ResendEmailConfirmationBodySchema,
    SessionTokenBodySchema,
    StatsQuerySchema,
    StatsTagReportQuerySchema,
    StatsTagReportSchema,
    TimeZoneSchema,
    TokenResponseSchema,
    TransactionListQuerySchema,
    TransactionScanBodySchema,
    TransactionScanDecisionBodySchema,
    TransactionScanImageResponseSchema,
    TransactionScanJobResponseSchema,
    TransactionScanProgressEventSchema,
    TransactionScanProgressQuerySchema,
    TransactionScanResponseSchema,
    TransactionSchema,
    UpdateCategoryBodySchema,
    UpdateUserPreferenceBodySchema,
    UpdateVendorBodySchema,
    UserPreferenceSchema,
    VendorCandidateDetailsQuerySchema,
    VendorCandidateSchema,
    VendorCandidateSearchQuerySchema,
    VendorListQuerySchema,
    VendorSchema
} from './schemas.js';

describe('shared schemas', () => {
    it('accepts ISO currency codes', () => {
        expect(CurrencyCodeSchema.validate('USD').valid).toBe(true);
        expect(CurrencyCodeSchema.validate('usd').valid).toBe(false);
    });

    it('validates registration shape', () => {
        const result = RegisterBodySchema.validate({
            email: 'jane@example.com',
            password: 'super-secret',
            confirmPassword: 'super-secret',
            defaultCurrency: 'USD',
            countryCode: 'US',
            favoriteCurrencies: ['EUR', 'GBP']
        });

        expect(result.valid).toBe(true);
        expect(result.object?.timezone).toBe('UTC');
    });

    it('validates email confirmation payloads', () => {
        expect(
            EmailConfirmationPendingResponseSchema.validate({
                email: 'jane@example.com',
                verificationRequired: true,
                message: 'Check your email.'
            }).valid
        ).toBe(true);
        expect(ConfirmEmailBodySchema.validate({ token: 'abc123' }).valid).toBe(
            true
        );
        expect(ConfirmEmailBodySchema.validate({ token: '' }).valid).toBe(
            false
        );
        expect(
            ResendEmailConfirmationBodySchema.validate({
                email: 'jane@example.com'
            }).valid
        ).toBe(true);
    });

    it('rejects auth values longer than persisted identity fields', () => {
        const registerResult = RegisterBodySchema.validate(
            {
                email: `${'a'.repeat(FieldLimits.email)}@example.com`,
                password: 'super-secret',
                confirmPassword: 'super-secret',
                defaultCurrency: 'USD',
                countryCode: 'US',
                favoriteCurrencies: [],
                timezone: 'UTC'
            },
            { doNotStopOnFirstError: true }
        );
        expect(registerResult.valid).toBe(false);
        expect(
            registerResult.getErrorsFor(field => field.email).errors
        ).toContain('email is too long');

        const passwordResult = RegisterBodySchema.validate({
            email: 'jane@example.com',
            password: 'x'.repeat(FieldLimits.password + 1),
            confirmPassword: 'x'.repeat(FieldLimits.password + 1),
            defaultCurrency: 'USD',
            countryCode: 'US',
            favoriteCurrencies: [],
            timezone: 'UTC'
        });
        expect(passwordResult.valid).toBe(false);
        expect(
            passwordResult.getErrorsFor(field => field.password).errors
        ).toContain('password is too long');

        const tokenResult = ConfirmEmailBodySchema.validate({
            token: 'x'.repeat(FieldLimits.confirmationToken + 1)
        });
        expect(tokenResult.valid).toBe(false);
        expect(tokenResult.getErrorsFor(field => field.token).errors).toContain(
            'confirmation token is too long'
        );
    });

    it('validates IANA time zones in preferences', () => {
        expect(TimeZoneSchema.validate('America/New_York').valid).toBe(true);
        expect(TimeZoneSchema.validate('Not/AZone').valid).toBe(false);
        expect(
            UpdateUserPreferenceBodySchema.validate({
                defaultCurrency: 'USD',
                countryCode: 'US',
                favoriteCurrencies: ['EUR'],
                timezone: 'Europe/London'
            }).valid
        ).toBe(true);
    });

    it('rejects preference and Passport identity values longer than DB columns', () => {
        const timezoneResult = UpdateUserPreferenceBodySchema.validate({
            defaultCurrency: 'USD',
            countryCode: 'US',
            favoriteCurrencies: ['EUR'],
            timezone: 'A'.repeat(FieldLimits.timeZone + 1)
        });
        expect(timezoneResult.valid).toBe(false);
        expect(
            timezoneResult.getErrorsFor(field => field.timezone).errors
        ).toContain('timezone is too long');

        const passportResult = PassportResolveUserBodySchema.validate({
            provider: 'google',
            provider_subject: 'g'.repeat(FieldLimits.passportSubject + 1),
            email: 'jane@example.com',
            email_verified: true
        });
        expect(passportResult.valid).toBe(false);
        expect(
            passportResult.getErrorsFor(field => field.provider_subject).errors
        ).toContain('provider subject is too long');
    });

    it('validates user preferences with derived transaction currencies', () => {
        const result = UserPreferenceSchema.validate({
            id: 1,
            email: 'jane@example.com',
            defaultCurrency: 'USD',
            countryCode: 'US',
            favoriteCurrencies: ['EUR'],
            transactionCurrencies: ['EUR', 'USD'],
            timezone: 'UTC',
            hasCategories: true,
            mainBudgetId: 1,
            budgets: [
                {
                    id: 1,
                    name: 'Main',
                    defaultCurrency: 'USD',
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
                    createdAt: new Date(),
                    updatedAt: new Date()
                }
            ],
            weeklyEmailReportEnabled: true,
            monthlyEmailReportEnabled: true
        });

        expect(result.valid).toBe(true);
    });

    it('validates category archive update payloads', () => {
        const result = UpdateCategoryBodySchema.validate({
            archived: true
        });

        expect(result.valid).toBe(true);
        expect(result.object?.archived).toBe(true);
    });

    it('validates category move-and-delete payloads', () => {
        const result = MoveAndDeleteCategoryBodySchema.validate({
            replacementCategoryId: 12
        });

        expect(result.valid).toBe(true);
        expect(result.object?.replacementCategoryId).toBe(12);
    });

    it('defaults email report preferences to enabled when updating preferences', () => {
        const result = UpdateUserPreferenceBodySchema.validate({
            defaultCurrency: 'USD',
            countryCode: 'US',
            favoriteCurrencies: ['EUR'],
            timezone: 'UTC'
        });

        expect(result.valid).toBe(true);
        expect(result.object?.weeklyEmailReportEnabled).toBe(true);
        expect(result.object?.monthlyEmailReportEnabled).toBe(true);
    });

    it('validates category list sorting controls', () => {
        expect(
            CategoryListQuerySchema.validate({
                activeOnly: 'true',
                budgetId: '1',
                sort: 'recent-transaction-count'
            } as never).object?.activeOnly
        ).toBe(true);
        expect(CategoryListQuerySchema.validate({}).valid).toBe(true);
        expect(
            CategoryListQuerySchema.validate({ sort: 'name' } as never).valid
        ).toBe(false);
    });

    it('validates category hierarchy and kind fields', () => {
        expect(
            CreateCategoryBodySchema.validate({
                name: 'Returns',
                type: 'expense',
                parentId: 1,
                kind: 'offset'
            }).valid
        ).toBe(true);

        const result = CategorySchema.validate({
            id: 2,
            budgetId: 1,
            name: 'Returns',
            type: 'expense',
            kind: 'offset',
            parentId: 1,
            parentName: 'Car',
            displayName: 'Car -> Returns',
            inUse: true,
            hasChildren: false,
            archivedAt: null,
            createdAt: new Date(),
            updatedAt: new Date()
        });

        expect(result.valid).toBe(true);
    });

    it('validates vendor payloads', () => {
        expect(
            CreateVendorBodySchema.validate({
                name: 'Trader Joe',
                brandfetchBrandId: 'id_trader_joe',
                resolvedName: 'Trader Joe',
                domain: 'traderjoes.com',
                logoUrl: 'https://example.com/logo.svg'
            }).valid
        ).toBe(true);
        expect(CreateVendorBodySchema.validate({ name: '' }).valid).toBe(false);

        expect(
            VendorCandidateSearchQuerySchema.validate({
                query: 'Trader Joe',
                limit: 3
            }).valid
        ).toBe(true);
        expect(
            VendorCandidateDetailsQuerySchema.validate({
                brandfetchBrandId: 'id_trader_joe'
            }).valid
        ).toBe(true);
        expect(VendorCandidateDetailsQuerySchema.validate({}).valid).toBe(
            false
        );
        expect(
            VendorCandidateSchema.validate({
                brandfetchBrandId: 'id_trader_joe',
                name: 'Trader Joe',
                domain: 'traderjoes.com',
                logoUrl: 'https://example.com/logo.svg',
                description: 'Neighborhood grocery store.',
                primaryColor: '#cc0000',
                claimed: true
            }).valid
        ).toBe(true);

        expect(
            VendorSchema.validate({
                id: 3,
                budgetId: 1,
                name: 'Trader Joe',
                displayName: 'Trader Joe',
                resolvedName: 'Trader Joe',
                domain: 'traderjoes.com',
                logoUrl: 'https://example.com/logo.svg',
                enrichmentProvider: 'brandfetch',
                enrichmentStatus: 'success',
                enrichedAt: new Date(),
                suggestedCategoryId: 1,
                suggestedCategoryDisplayName: 'Groceries',
                transactionCount: 2,
                createdAt: new Date(),
                updatedAt: new Date()
            }).valid
        ).toBe(true);

        expect(
            UpdateVendorBodySchema.validate({
                name: 'Trader Joe',
                resolvedName: null,
                description: null,
                domain: 'traderjoes.com',
                logoUrl: 'https://example.com/logo.svg',
                primaryColor: '#cc0000'
            }).valid
        ).toBe(true);

        expect(
            UpdateVendorBodySchema.validate({
                name: 'Trader Joe',
                logoUrl: '',
                primaryColor: ''
            }).valid
        ).toBe(true);
    });

    it('validates editable vendor metadata formats', () => {
        const logoResult = UpdateVendorBodySchema.validate({
            name: 'Trader Joe',
            logoUrl: 'http://example.com/logo.svg'
        });
        expect(logoResult.valid).toBe(false);
        expect(logoResult.getErrorsFor(field => field.logoUrl).errors).toEqual([
            'Logo URL must be a valid HTTPS URL.'
        ]);

        const colorResult = UpdateVendorBodySchema.validate({
            name: 'Trader Joe',
            primaryColor: '0071ce'
        });
        expect(colorResult.valid).toBe(false);
        expect(
            colorResult.getErrorsFor(field => field.primaryColor).errors
        ).toEqual(['Primary color must be a six-digit hex color.']);
    });

    it('rejects vendor values longer than persisted vendor fields', () => {
        const createResult = CreateVendorBodySchema.validate({
            name: 'x'.repeat(FieldLimits.vendorName + 1)
        });
        expect(createResult.valid).toBe(false);
        expect(createResult.getErrorsFor(field => field.name).errors).toContain(
            'vendor name is too long'
        );

        const updateResult = UpdateVendorBodySchema.validate(
            {
                name: 'Trader Joe',
                domain: 'x'.repeat(FieldLimits.vendorDomain + 1),
                description: 'Г'.repeat(FieldLimits.vendorDescription + 1),
                logoUrl: `https://example.com/${'x'.repeat(
                    FieldLimits.vendorLogoUrl
                )}`,
                primaryColor: '#0071ce0'
            },
            { doNotStopOnFirstError: true }
        );
        expect(updateResult.valid).toBe(false);
        expect(
            updateResult.getErrorsFor(field => field.domain).errors
        ).toContain('domain is too long');
        expect(
            updateResult.getErrorsFor(field => field.description).errors
        ).toContain('description is too long');
        expect(
            updateResult.getErrorsFor(field => field.logoUrl).errors
        ).toContain('logo URL is too long');
        expect(
            updateResult.getErrorsFor(field => field.primaryColor).errors
        ).toContain('primary color is too long');

        const searchResult = VendorListQuerySchema.validate({
            search: 'x'.repeat(FieldLimits.vendorSearch + 1)
        });
        expect(searchResult.valid).toBe(false);
        expect(
            searchResult.getErrorsFor(field => field.search).errors
        ).toContain('vendor search query is too long');
    });

    it('returns required messages before format messages for empty login fields', () => {
        const result = LoginBodySchema.validate(
            { email: '', password: '' },
            { doNotStopOnFirstError: true }
        );

        expect(result.valid).toBe(false);
        expect(result.getErrorsFor(field => field.email).errors[0]).toBe(
            'email is required'
        );
        expect(result.getErrorsFor(field => field.password).errors[0]).toBe(
            'password is required'
        );
    });

    it('validates session token refresh bodies and token responses', () => {
        expect(SessionTokenBodySchema.validate({ userId: 12 }).valid).toBe(
            true
        );
        expect(
            SessionTokenBodySchema.validate({ userId: 'abc' } as never).valid
        ).toBe(false);

        expect(
            TokenResponseSchema.validate({
                token: 'api-token',
                expiresAt: new Date('2026-06-01T00:00:00.000Z'),
                user: {
                    id: 12,
                    email: 'jane@example.com',
                    role: 'user',
                    defaultCurrency: 'USD',
                    countryCode: 'US',
                    timezone: 'UTC',
                    hasCategories: false,
                    mainBudgetId: 1
                }
            }).valid
        ).toBe(true);
    });

    it('validates Passport auth payloads', () => {
        expect(
            PassportResolveUserBodySchema.validate({
                provider: 'google',
                provider_subject: 'google-subject',
                email: 'jane@example.com',
                email_verified: true
            }).valid
        ).toBe(true);
        expect(
            PassportExchangeBodySchema.validate({
                code: 'abc123',
                codeVerifier: 'a'.repeat(43)
            }).valid
        ).toBe(true);
        expect(
            PassportExchangeBodySchema.validate({
                code: '',
                codeVerifier: 'a'.repeat(43)
            }).valid
        ).toBe(false);
    });

    it('validates direct Google sign-in payloads', () => {
        expect(
            GoogleSignInBodySchema.validate({
                providerSubject: 'google-subject',
                email: 'jane@example.com',
                emailVerified: true,
                name: 'Jane Doe',
                avatarUrl: 'https://example.com/avatar.png'
            }).valid
        ).toBe(true);
        expect(
            GoogleSignInBodySchema.validate({
                providerSubject: '',
                email: 'jane@example.com',
                emailVerified: true
            }).valid
        ).toBe(false);
        expect(
            GoogleSignInBodySchema.validate({
                providerSubject: 'google-subject',
                email: 'not-an-email',
                emailVerified: true
            }).valid
        ).toBe(false);
    });

    it('rejects mismatched registration passwords', () => {
        const result = RegisterBodySchema.validate({
            email: 'jane@example.com',
            password: 'super-secret',
            confirmPassword: 'different-secret',
            defaultCurrency: 'USD',
            countryCode: 'US',
            favoriteCurrencies: ['EUR', 'GBP']
        });

        expect(result.valid).toBe(false);
        expect(
            result.getErrorsFor(field => field.confirmPassword).errors
        ).toEqual(['passwords do not match']);
    });

    it('rejects non-positive transaction amounts', () => {
        const result = CreateTransactionBodySchema.validate({
            categoryId: 1,
            amount: 0,
            currency: 'USD',
            occurredAt: new Date()
        });

        expect(result.valid).toBe(false);
    });

    it('accepts transaction amounts with cents', () => {
        const result = CreateTransactionBodySchema.validate({
            categoryId: 1,
            amount: 1234.56,
            currency: 'USD',
            occurredAt: new Date()
        });

        expect(result.valid).toBe(true);
    });

    it('accepts larger cent amounts despite floating point modulo artifacts', () => {
        const result = CreateTransactionBodySchema.validate({
            categoryId: 1,
            amount: 17_789.3,
            currency: 'UAH',
            occurredAt: new Date()
        });

        expect(result.valid).toBe(true);
    });

    it('rejects transaction amounts below cent precision', () => {
        const result = CreateTransactionBodySchema.validate({
            categoryId: 1,
            amount: 12.345,
            currency: 'USD',
            occurredAt: new Date()
        });

        expect(result.valid).toBe(false);
        expect(result.getErrorsFor(field => field.amount).errors[0]).toBe(
            'amount can have at most two decimal places'
        );
    });

    it('returns a required message for missing transaction amounts', () => {
        const result = CreateTransactionBodySchema.validate(
            {
                categoryId: 1,
                currency: 'USD',
                occurredAt: new Date()
            } as never,
            { doNotStopOnFirstError: true }
        );

        expect(result.valid).toBe(false);
        expect(result.getErrorsFor(field => field.amount).errors[0]).toBe(
            'amount is required'
        );
    });

    it('validates transaction image scan payloads and feedback', () => {
        expect(
            TransactionScanBodySchema.validate({
                imageBase64: 'aW1hZ2U=',
                mimeType: 'image/png',
                fileName: 'receipt.png'
            }).valid
        ).toBe(true);
        expect(
            TransactionScanBodySchema.validate({
                imageBase64: 'aW1hZ2U=',
                mimeType: 'application/pdf'
            } as never).valid
        ).toBe(false);

        expect(
            TransactionScanResponseSchema.validate({
                scanId: 10,
                documentKind: 'receipt',
                warnings: ['Check date.'],
                drafts: [
                    {
                        id: 20,
                        amount: 12.34,
                        categoryId: 1,
                        suggestedCategory: null,
                        currency: 'USD',
                        occurredAt: new Date('2026-06-01T12:00:00.000Z'),
                        vendorId: null,
                        suggestedVendorName: 'Walmart',
                        transactionType: 'expense',
                        note: null,
                        evidence: 'Walmart 12.34',
                        confidence: {
                            amount: 'high',
                            category: 'medium',
                            currency: 'high',
                            date: 'low',
                            overall: 'medium',
                            vendor: 'medium'
                        },
                        possibleDuplicateTransactionIds: [99]
                    }
                ]
            }).valid
        ).toBe(true);

        expect(
            TransactionScanDecisionBodySchema.validate({
                decision: 'confirmed',
                transactionId: 42,
                correctedTransaction: {
                    amount: 12.34,
                    categoryId: 1,
                    currency: 'USD',
                    occurredAt: new Date('2026-06-01T12:00:00.000Z'),
                    vendorId: null,
                    note: null
                },
                attachment: {
                    imageBase64: 'aW1hZ2U=',
                    mimeType: 'image/png',
                    fileName: 'receipt.png'
                }
            }).valid
        ).toBe(true);

        expect(
            TransactionScanJobResponseSchema.validate({
                jobId: '3baf2c5a-c8d3-45f4-a6c0-35a09407d42e',
                token: 'scan-token'
            }).valid
        ).toBe(true);

        expect(
            TransactionScanProgressQuerySchema.validate({
                jobId: '3baf2c5a-c8d3-45f4-a6c0-35a09407d42e',
                token: 'scan-token'
            }).valid
        ).toBe(true);

        expect(
            TransactionScanProgressEventSchema.validate({
                jobId: '3baf2c5a-c8d3-45f4-a6c0-35a09407d42e',
                stage: 'complete',
                message: 'Scan complete.',
                progress: 100,
                scan: {
                    scanId: 10,
                    documentKind: 'receipt',
                    warnings: [],
                    drafts: []
                },
                error: null
            }).valid
        ).toBe(true);

        expect(
            TransactionSchema.validate({
                id: 42,
                budgetId: 1,
                categoryId: 1,
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
                occurredAt: new Date('2026-06-01T12:00:00.000Z'),
                tags: [
                    {
                        id: 1,
                        budgetId: 1,
                        name: 'wife',
                        transactionCount: 2,
                        createdAt: new Date('2026-06-01T12:00:00.000Z'),
                        updatedAt: new Date('2026-06-01T12:00:00.000Z')
                    }
                ],
                scanAttachment: {
                    scanId: 10,
                    scanItemId: 20,
                    fileName: 'receipt.png',
                    mimeType: 'image/png',
                    sizeBytes: 5,
                    createdAt: new Date('2026-06-01T12:00:00.000Z')
                },
                createdAt: new Date('2026-06-01T12:00:00.000Z'),
                updatedAt: new Date('2026-06-01T12:00:00.000Z')
            }).valid
        ).toBe(true);

        expect(
            TransactionScanImageResponseSchema.validate({
                scanId: 10,
                scanItemId: 20,
                fileName: 'receipt.png',
                mimeType: 'image/png',
                sizeBytes: 5,
                createdAt: new Date('2026-06-01T12:00:00.000Z'),
                imageBase64: 'aW1hZ2U='
            }).valid
        ).toBe(true);
    });

    it('validates stats reporting controls', () => {
        expect(
            StatsQuerySchema.validate({
                groupBy: 'week',
                timeframe: 'custom',
                from: new Date('2026-05-01T00:00:00.000Z'),
                to: new Date('2026-05-10T00:00:00.000Z')
            }).valid
        ).toBe(true);
        expect(
            StatsQuerySchema.validate({
                groupBy: 'hour',
                period: 'day',
                date: new Date('2026-05-10T00:00:00.000Z')
            }).valid
        ).toBe(true);
        expect(
            StatsQuerySchema.validate({
                groupBy: 'quarter',
                timeframe: 'this-month'
            } as never).valid
        ).toBe(false);
        expect(
            StatsTagReportQuerySchema.validate({
                period: 'month',
                tag: 'untagged'
            }).object?.tag
        ).toBe('untagged');
        expect(
            StatsTagReportQuerySchema.validate({
                period: 'month',
                tag: '12'
            } as never).object?.tag
        ).toBe(12);
        expect(
            StatsTagReportSchema.validate({
                period: 'month',
                from: new Date('2026-05-01T00:00:00.000Z'),
                to: new Date('2026-05-31T23:59:59.999Z'),
                currency: 'USD',
                expenseTotal: 35,
                expenseCount: 3,
                untaggedCount: 1,
                tags: [
                    {
                        tagId: 10,
                        tagName: 'me',
                        kind: 'tag',
                        total: 30,
                        share: 85.7,
                        transactionCount: 2,
                        averageExpense: 15
                    },
                    {
                        tagId: null,
                        tagName: 'Untagged',
                        kind: 'untagged',
                        total: 5,
                        share: 14.3,
                        transactionCount: 1,
                        averageExpense: 5
                    }
                ],
                selectedTag: null
            }).valid
        ).toBe(true);
    });

    it('validates dashboard vendor window limits separately from generic period windows', () => {
        const dashboardResult = DashboardWindowQuerySchema.validate({
            after: 2,
            before: 2,
            currency: 'EUR',
            vendorLimit: 100,
            period: 'month'
        });
        const genericResult = PeriodWindowQuerySchema.validate({
            after: 2,
            before: 2,
            vendorLimit: 100,
            period: 'month'
        } as never);

        expect(dashboardResult.valid).toBe(true);
        expect(dashboardResult.object?.currency).toBe('EUR');
        expect(dashboardResult.object?.vendorLimit).toBe(100);
        expect(genericResult.valid).toBe(false);
    });

    it('validates dashboard vendor summaries', () => {
        expect(
            DashboardSummarySchema.validate({
                period: 'month',
                from: new Date('2026-05-01T00:00:00.000Z'),
                to: new Date('2026-05-31T23:59:59.999Z'),
                currency: 'USD',
                expenseTotal: 100,
                incomeTotal: 0,
                comparison: {
                    previousPeriod: {
                        from: new Date('2026-04-01T00:00:00.000Z'),
                        to: new Date('2026-04-30T23:59:59.999Z'),
                        expenseTotal: 80,
                        incomeTotal: 20,
                        netTotal: -60
                    }
                },
                vendorCount: 1,
                topVendors: [
                    {
                        vendorId: 7,
                        vendorName: 'Walmart',
                        vendorDomain: 'walmart.com',
                        vendorLogoUrl: 'https://walmart.com/logo.svg',
                        vendorPrimaryColor: '#0071ce',
                        type: 'expense',
                        total: 100,
                        transactionCount: 3,
                        trend: [20, 80]
                    },
                    {
                        vendorId: null,
                        vendorName: 'No vendor',
                        type: 'income',
                        total: 50,
                        transactionCount: 1,
                        trend: [0, 50]
                    }
                ],
                categoryVendorBreakdown: [
                    {
                        categoryId: 1,
                        categoryName: 'Groceries',
                        categoryDisplayName: 'Groceries',
                        categoryParentId: null,
                        categoryKind: 'normal',
                        vendorId: 7,
                        vendorName: 'Walmart',
                        vendorDomain: 'walmart.com',
                        vendorLogoUrl: 'https://walmart.com/logo.svg',
                        vendorPrimaryColor: '#0071ce',
                        type: 'expense',
                        total: 100,
                        transactionCount: 3,
                        trend: [20, 80]
                    }
                ],
                byCategory: [],
                byParentCategory: []
            }).valid
        ).toBe(true);
    });

    it('validates vendor-less transaction filters', () => {
        expect(
            TransactionListQuerySchema.validate({ vendorId: 'none' }).object
                ?.vendorId
        ).toBe('none');
        expect(
            TransactionListQuerySchema.validate({ vendorId: 42 }).object
                ?.vendorId
        ).toBe(42);
    });

    it('validates transaction tag assignments and filters', () => {
        const body = CreateTransactionBodySchema.validate({
            categoryId: 1,
            amount: 12,
            currency: 'USD',
            occurredAt: new Date(),
            tags: [' wife ', 'wife', 'travel']
        });
        expect(body.valid).toBe(true);

        const emptyTag = CreateTransactionBodySchema.validate({
            categoryId: 1,
            amount: 12,
            currency: 'USD',
            occurredAt: new Date(),
            tags: ['   ']
        });
        expect(emptyTag.valid).toBe(false);
        expect(emptyTag.getErrorsFor(field => field.tags).errors).toContain(
            'tag name is required'
        );

        const tooManyTags = CreateTransactionBodySchema.validate({
            categoryId: 1,
            amount: 12,
            currency: 'USD',
            occurredAt: new Date(),
            tags: Array.from(
                { length: TransactionTagLimits.maxTagsPerTransaction + 1 },
                (_, index) => `tag-${index}`
            )
        });
        expect(tooManyTags.valid).toBe(false);
        expect(tooManyTags.getErrorsFor(field => field.tags).errors).toContain(
            `transactions can have at most ${TransactionTagLimits.maxTagsPerTransaction} tags`
        );

        expect(
            TransactionListQuerySchema.validate({ tagIds: '1,2,3' }).object
                ?.tagIds
        ).toBe('1,2,3');
        expect(
            TransactionListQuerySchema.validate({ tagIds: '1,nope' }).valid
        ).toBe(false);
        expect(
            TransactionListQuerySchema.validate({ untagged: 'true' } as never)
                .object?.untagged
        ).toBe(true);
    });

    it('rejects transaction note and search text over the configured limits', () => {
        const noteResult = CreateTransactionBodySchema.validate({
            categoryId: 1,
            amount: 12,
            currency: 'USD',
            occurredAt: new Date(),
            note: 'x'.repeat(FieldLimits.transactionNote + 1)
        });
        expect(noteResult.valid).toBe(false);
        expect(noteResult.getErrorsFor(field => field.note).errors).toContain(
            'note is too long'
        );

        const searchResult = TransactionListQuerySchema.validate({
            search: 'x'.repeat(FieldLimits.transactionSearch + 1)
        });
        expect(searchResult.valid).toBe(false);
        expect(
            searchResult.getErrorsFor(field => field.search).errors
        ).toContain('transaction search query is too long');
    });

    it('validates category trend controls', () => {
        expect(
            CategoryTrendQuerySchema.validate({
                groupBy: 'month',
                range: 'last-12-months'
            }).valid
        ).toBe(true);
        expect(
            CategoryTrendQuerySchema.validate({
                groupBy: 'year',
                range: 'all-time'
            }).valid
        ).toBe(true);
        expect(
            CategoryTrendQuerySchema.validate({
                groupBy: 'week',
                range: 'custom',
                from: new Date('2026-01-01T00:00:00.000Z'),
                to: new Date('2026-03-01T00:00:00.000Z')
            }).valid
        ).toBe(true);
        expect(
            CategoryTrendQuerySchema.validate({
                groupBy: 'hour',
                range: 'last-12-months'
            } as never).valid
        ).toBe(false);
        expect(
            CategoryTrendQuerySchema.validate({
                groupBy: 'day',
                range: 'custom'
            } as never).valid
        ).toBe(false);
    });

    it('validates currency conversion previews', () => {
        const result = CurrencyConversionQuerySchema.validate({
            amount: 12.5,
            currency: 'EUR'
        });

        expect(result.valid).toBe(true);
        expect(
            CurrencyConversionQuerySchema.validate({
                amount: 0,
                currency: 'EUR'
            }).valid
        ).toBe(false);
    });

    it('validates Telegram service link bodies', () => {
        expect(
            LinkTelegramAccountBodySchema.validate({
                token: 'abc123',
                telegramUser: {
                    telegramUserId: '123456789',
                    telegramUsername: 'jane'
                }
            }).valid
        ).toBe(true);
        expect(
            LinkTelegramAccountBodySchema.validate({
                token: '',
                telegramUser: { telegramUserId: '' }
            }).valid
        ).toBe(false);

        const result = LinkTelegramAccountBodySchema.validate(
            {
                token: 'x'.repeat(FieldLimits.telegramLinkToken + 1),
                telegramUser: {
                    telegramUserId: '1'.repeat(FieldLimits.telegramUserId + 1),
                    telegramUsername: 'x'.repeat(
                        FieldLimits.telegramUsername + 1
                    )
                }
            },
            { doNotStopOnFirstError: true }
        );
        expect(result.valid).toBe(false);
        expect(result.getErrorsFor(field => field.token).errors).toContain(
            'link token is too long'
        );
        expect(
            result.getErrorsFor(field => field.telegramUser.telegramUserId)
                .errors
        ).toContain('Telegram user id is too long');
        expect(
            result.getErrorsFor(field => field.telegramUser.telegramUsername)
                .errors
        ).toContain('Telegram username is too long');
    });

    it('validates API key names', () => {
        expect(
            CreateApiKeyBodySchema.validate({ name: 'Import script' }).valid
        ).toBe(true);
        expect(CreateApiKeyBodySchema.validate({ name: '' }).valid).toBe(false);
        expect(CreateApiKeyBodySchema.validate({ name: '   ' }).valid).toBe(
            false
        );
    });
});
