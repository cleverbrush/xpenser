import { mapper } from '@cleverbrush/mapper';
import { array, type InferType, string } from '@cleverbrush/schema';
import {
    TransactionCreatorSchema,
    TransactionScanAttachmentSchema,
    TransactionSchema,
    TransactionTagSchema
} from '@xpenser/contracts';
import { perConnection } from '../read-models.js';
import {
    scanAttachmentRead,
    transactionListRead
} from '../transaction-queries.js';

/** Joined database fields plus application-owned enrichment; metadata never runs SQL. */
export const transactionMappingSource = perConnection(knex =>
    transactionListRead(knex)
        .rowSchema.omit(['categoryType', 'userId'])
        .addProps({
            categoryDisplayName: string(),
            tags: array(TransactionTagSchema),
            createdBy: TransactionCreatorSchema,
            scanAttachment: TransactionScanAttachmentSchema.nullable()
        })
);
export type TransactionMappingSource = InferType<
    ReturnType<typeof transactionMappingSource>
>;
export const transactionMapping = perConnection(knex => {
    const TransactionMappingSourceSchema = transactionMappingSource(knex);
    return mapper()
        .configure(TransactionMappingSourceSchema, TransactionSchema, mapping =>
            mapping
                .for(target => target.categoryKind)
                .compute(source =>
                    source.categoryKind === 'offset' ? 'offset' : 'normal'
                )
                .for(target => target.type)
                .compute(source =>
                    source.type === 'income' ? 'income' : 'expense'
                )
                .for(target => target.vendorName)
                .compute(source => source.vendorName ?? undefined)
                .for(target => target.vendorLogoUrl)
                .compute(source => source.vendorLogoUrl ?? undefined)
                .for(target => target.categoryParentName)
                .compute(source => source.categoryParentName ?? undefined)
                .for(target => target.note)
                .compute(source => source.note ?? undefined)
                .for(target => target.scanAttachment)
                .compute(source => source.scanAttachment)
                .for(target => target.amount)
                .compute(source => Number(source.amount))
                .for(target => target.defaultCurrencyAmount)
                .compute(source => Number(source.defaultCurrencyAmount))
                .for(target => target.exchangeRate)
                .compute(source => Number(source.exchangeRate))
                .for(target => target.exchangeRateDate)
                .compute(source =>
                    source.exchangeRateDate.toISOString().slice(0, 10)
                )
        )
        .getSyncMapper(TransactionMappingSourceSchema, TransactionSchema);
});

export const scanAttachmentMapping = perConnection(knex => {
    const TransactionScanAttachmentSourceSchema = scanAttachmentRead(
        knex
    ).rowSchema.pick([
        'scanId',
        'scanItemId',
        'fileName',
        'mimeType',
        'sizeBytes',
        'createdAt'
    ]);
    return mapper()
        .configure(
            TransactionScanAttachmentSourceSchema,
            TransactionScanAttachmentSchema,
            mapping =>
                mapping
                    .for(target => target.mimeType)
                    .compute(source => {
                        if (
                            source.mimeType === 'image/png' ||
                            source.mimeType === 'image/webp'
                        ) {
                            return source.mimeType;
                        }
                        return 'image/jpeg';
                    })
                    .for(target => target.sizeBytes)
                    .compute(source => Number(source.sizeBytes))
        )
        .getSyncMapper(
            TransactionScanAttachmentSourceSchema,
            TransactionScanAttachmentSchema
        );
});
