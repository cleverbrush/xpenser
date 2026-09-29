import type { InferType } from '@cleverbrush/schema';
import { describe, expect, expectTypeOf, it } from 'vitest';
import {
    type StatsTagDetailSchema,
    StatsTagReportSchema,
    type TransactionScanAttachmentBodySchema,
    type TransactionScanCorrectedTransactionSchema,
    TransactionScanDecisionBodySchema,
    TransactionScanDraftSchema,
    TransactionScanProgressEventSchema,
    type TransactionScanResponseSchema,
    type TransactionScanSuggestedCategorySchema
} from './schemas.js';

describe('named schema composition', () => {
    const requiredNullable = [
        TransactionScanDraftSchema.introspect().properties.suggestedCategory,
        TransactionScanProgressEventSchema.introspect().properties.scan,
        StatsTagReportSchema.introspect().properties.selectedTag
    ];

    it.each(
        requiredNullable
    )('keeps nullable named objects required', schema => {
        expect(schema.safeParse(null).valid).toBe(true);
        for (const value of [undefined, false, 'invalid', [], {}]) {
            expect(schema.safeParse(value).valid).toBe(false);
        }
    });

    it('preserves omitted, undefined, and null optional scan decisions', () => {
        expect(
            TransactionScanDecisionBodySchema.safeParse({
                decision: 'discarded'
            }).valid
        ).toBe(true);
        for (const value of [undefined, null]) {
            expect(
                TransactionScanDecisionBodySchema.safeParse({
                    decision: 'discarded',
                    correctedTransaction: value,
                    attachment: value
                }).valid
            ).toBe(true);
        }
        for (const field of ['correctedTransaction', 'attachment']) {
            for (const value of [false, 'invalid', [], {}]) {
                expect(
                    TransactionScanDecisionBodySchema.safeParse({
                        decision: 'confirmed',
                        [field]: value
                    }).valid
                ).toBe(false);
            }
        }
    });

    it('keeps nested object selectors available for validation errors', () => {
        const result = TransactionScanDecisionBodySchema.validate(
            {
                decision: 'confirmed',
                correctedTransaction: {
                    amount: 'invalid',
                    categoryId: 1,
                    vendorId: null,
                    currency: 'USD',
                    occurredAt: new Date(),
                    note: null
                },
                attachment: {
                    imageBase64: 'aW1hZ2U=',
                    mimeType: 'application/pdf'
                }
            } as never,
            { doNotStopOnFirstError: true }
        );
        expect(result.valid).toBe(false);
        expect(
            result.getErrorsFor(field => field.correctedTransaction.amount)
                .errors.length
        ).toBeGreaterThan(0);
        expect(
            result.getErrorsFor(field => field.attachment.mimeType).errors
                .length
        ).toBeGreaterThan(0);
    });

    it('preserves public inferred types', () => {
        expectTypeOf<
            InferType<typeof TransactionScanDraftSchema>['suggestedCategory']
        >().toEqualTypeOf<InferType<
            typeof TransactionScanSuggestedCategorySchema
        > | null>();
        expectTypeOf<
            InferType<typeof TransactionScanProgressEventSchema>['scan']
        >().toEqualTypeOf<InferType<
            typeof TransactionScanResponseSchema
        > | null>();
        expectTypeOf<
            InferType<typeof StatsTagReportSchema>['selectedTag']
        >().toEqualTypeOf<InferType<typeof StatsTagDetailSchema> | null>();
        expectTypeOf<
            InferType<
                typeof TransactionScanDecisionBodySchema
            >['correctedTransaction']
        >().toEqualTypeOf<
            | InferType<typeof TransactionScanCorrectedTransactionSchema>
            | null
            | undefined
        >();
        expectTypeOf<
            InferType<typeof TransactionScanDecisionBodySchema>['attachment']
        >().toEqualTypeOf<
            InferType<typeof TransactionScanAttachmentBodySchema> | undefined
        >();
    });
});
