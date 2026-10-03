import { createHash } from 'node:crypto';
import type { AppDb, TransactionScanItemDb } from '../src/db/schemas.js';

export const occurredAt = new Date('2026-06-01T12:34:56.789Z');
export const draft: TransactionScanItemDb['draft'] = {
    amount: 12.34,
    categoryId: null,
    suggestedCategory: null,
    currency: 'USD',
    occurredAt,
    vendorId: null,
    suggestedVendorName: null,
    transactionType: 'expense',
    note: null,
    evidence: 'Receipt',
    confidence: {
        amount: 'high',
        category: 'high',
        currency: 'high',
        date: 'high',
        overall: 'high',
        vendor: 'high'
    },
    possibleDuplicateTransactionIds: []
};
export const attachment = {
    imageBase64: Buffer.from('receipt').toString('base64'),
    mimeType: 'image/png' as const,
    fileName: 'receipt.png'
};

export async function seedTransactionScan(db: AppDb) {
    await db.transactionScans.insert({
        id: 1,
        userId: 1,
        budgetId: 1,
        documentKind: 'receipt',
        imageHash: createHash('sha256').update('receipt').digest('hex'),
        model: 'test',
        warningsJson: '[]'
    });
}
