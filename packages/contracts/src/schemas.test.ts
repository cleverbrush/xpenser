import { describe, expect, it } from 'vitest';
import {
    CategoryListQuerySchema,
    CategoryTrendQuerySchema,
    ConfirmEmailBodySchema,
    CreateApiKeyBodySchema,
    CreateTransactionBodySchema,
    CurrencyCodeSchema,
    CurrencyConversionQuerySchema,
    EmailConfirmationPendingResponseSchema,
    LinkTelegramAccountBodySchema,
    LoginBodySchema,
    PassportExchangeBodySchema,
    PassportResolveUserBodySchema,
    RegisterBodySchema,
    ResendEmailConfirmationBodySchema,
    SessionTokenBodySchema,
    StatsQuerySchema,
    TimeZoneSchema,
    TokenResponseSchema,
    UpdateUserPreferenceBodySchema,
    UserPreferenceSchema
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

    it('validates IANA time zones in preferences', () => {
        expect(TimeZoneSchema.validate('America/New_York').valid).toBe(true);
        expect(TimeZoneSchema.validate('Not/AZone').valid).toBe(false);
        expect(
            UpdateUserPreferenceBodySchema.validate({
                defaultCurrency: 'USD',
                favoriteCurrencies: ['EUR'],
                timezone: 'Europe/London'
            }).valid
        ).toBe(true);
    });

    it('validates user preferences with derived transaction currencies', () => {
        const result = UserPreferenceSchema.validate({
            id: 1,
            email: 'jane@example.com',
            defaultCurrency: 'USD',
            favoriteCurrencies: ['EUR'],
            transactionCurrencies: ['EUR', 'USD'],
            timezone: 'UTC',
            hasCategories: true,
            weeklyEmailReportEnabled: true,
            monthlyEmailReportEnabled: true
        });

        expect(result.valid).toBe(true);
    });

    it('defaults email report preferences to enabled when updating preferences', () => {
        const result = UpdateUserPreferenceBodySchema.validate({
            defaultCurrency: 'USD',
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
                sort: 'recent-transaction-count'
            }).valid
        ).toBe(true);
        expect(CategoryListQuerySchema.validate({}).valid).toBe(true);
        expect(
            CategoryListQuerySchema.validate({ sort: 'name' } as never).valid
        ).toBe(false);
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
                    timezone: 'UTC',
                    hasCategories: false
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

    it('rejects mismatched registration passwords', () => {
        const result = RegisterBodySchema.validate({
            email: 'jane@example.com',
            password: 'super-secret',
            confirmPassword: 'different-secret',
            defaultCurrency: 'USD',
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

    it('accepts reversal transaction effects', () => {
        const result = CreateTransactionBodySchema.validate({
            categoryId: 1,
            amount: 1234.56,
            currency: 'USD',
            effect: 'reversal',
            occurredAt: new Date()
        });

        expect(result.valid).toBe(true);
        expect(result.object?.effect).toBe('reversal');
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
