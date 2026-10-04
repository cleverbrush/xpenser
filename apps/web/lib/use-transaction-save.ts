'use client';

import { TransactionSaveAttempt } from '@xpenser/client/transaction-save';
import type { CreateTransactionBody } from '@xpenser/contracts';
import { useRef } from 'react';
import { valuesToFormData } from '../components/forms/form-utils';

export function useTransactionSave(budgetId?: number) {
    const attempts = useRef(new Map<string, TransactionSaveAttempt>());
    return {
        formData(values: CreateTransactionBody, draft = 'manual') {
            let attempt = attempts.current.get(draft);
            if (!attempt) {
                attempt = new TransactionSaveAttempt();
                attempts.current.set(draft, attempt);
            }
            const request = attempt.prepare({ ...values, budgetId });
            const formData = valuesToFormData(request.body);
            formData.set(
                'idempotencyKey',
                request.headers['x-idempotency-key']
            );
            return formData;
        },
        reset(draft = 'manual') {
            attempts.current.delete(draft);
        }
    };
}
