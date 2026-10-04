import { number, object, string } from '@cleverbrush/schema';

export const TransactionIdempotencyHeadersSchema = object({
    'x-idempotency-key': string()
        .minLength(1)
        .maxLength(256)
        .optional()
        .describe(
            'Reuse this key only for the same transaction save attempt. Replay is process-local for up to 24 hours.'
        )
});

export const HttpProblemSchema = object({
    type: string(),
    status: number(),
    title: string(),
    detail: string().optional(),
    instance: string().optional()
}).schemaName('HttpProblem');
