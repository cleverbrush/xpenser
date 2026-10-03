import { mapper } from '@cleverbrush/mapper';
import { number } from '@cleverbrush/schema';
import { TransactionTagSchema } from '@xpenser/contracts';
import { transactionTagRead } from '../entity-reads.js';

const TransactionTagMappingSourceSchema = transactionTagRead.rowSchema
    .pick(['id', 'budgetId', 'name', 'createdAt', 'updatedAt'])
    .addProps({ transactionCount: number() });
export const transactionTagMapping = mapper()
    .configure(
        TransactionTagMappingSourceSchema,
        TransactionTagSchema,
        mapping =>
            mapping
                .for(target => target.id)
                .compute(source => Number(source.id))
                .for(target => target.budgetId)
                .compute(source => Number(source.budgetId))
    )
    .getSyncMapper(TransactionTagMappingSourceSchema, TransactionTagSchema);
