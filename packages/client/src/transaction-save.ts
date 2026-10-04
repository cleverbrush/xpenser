import type { CreateTransactionBody } from '@xpenser/contracts';

type SaveInput = Omit<CreateTransactionBody, 'occurredAt'> & {
    occurredAt?: Date;
};
export type TransactionSaveRequest = {
    readonly body: CreateTransactionBody;
    readonly headers: { readonly 'x-idempotency-key': string };
};

/** Active-session attempt state. Separate intentional saves always get separate keys. */
export class TransactionSaveAttempt {
    #current?: { fingerprint: string; request: TransactionSaveRequest };

    prepare(input: SaveInput): TransactionSaveRequest {
        const normalized = {
            budgetId: input.budgetId,
            categoryId: input.categoryId,
            vendorId: input.vendorId ?? null,
            amount: input.amount,
            currency: input.currency,
            occurredAt: input.occurredAt?.toISOString(),
            note: input.note,
            tags: [...(input.tags ?? [])]
        };
        const fingerprint = JSON.stringify(normalized);
        if (this.#current?.fingerprint !== fingerprint) {
            this.#current = {
                fingerprint,
                request: {
                    body: {
                        ...normalized,
                        occurredAt: input.occurredAt
                            ? new Date(input.occurredAt)
                            : new Date()
                    },
                    headers: { 'x-idempotency-key': crypto.randomUUID() }
                }
            };
        }
        return this.#current!.request;
    }

    reset(): void {
        this.#current = undefined;
    }
}

export function transactionSaveError(
    status: number | undefined
): string | undefined {
    if (status === 409)
        return 'The previous save could not be confirmed. Check your transaction list before saving again.';
    if (status === 503)
        return 'Saving is temporarily unavailable. Please try again shortly.';
    return undefined;
}
