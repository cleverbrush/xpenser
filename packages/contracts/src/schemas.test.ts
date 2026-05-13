import { describe, expect, it } from 'vitest';
import {
    CreateApiKeyBodySchema,
    CreateTransactionBodySchema,
    CurrencyCodeSchema,
    LinkTelegramAccountBodySchema,
    LoginBodySchema,
    RegisterBodySchema,
    StatsQuerySchema
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
                groupBy: 'quarter',
                timeframe: 'this-month'
            } as never).valid
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
