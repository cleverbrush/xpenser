import { mapper } from '@cleverbrush/mapper';
import { number } from '@cleverbrush/schema';
import { TransactionTagSchema } from '@xpenser/contracts';
import { transactionTagRead } from '../entity-reads.js';
import { perConnection } from '../read-models.js';
export const transactionTagMapping = perConnection(knex => {
    const TransactionTagMappingSourceSchema = transactionTagRead(knex)
        .rowSchema.pick(['id', 'budgetId', 'name', 'createdAt', 'updatedAt'])
        .addProps({ transactionCount: number() });
    return mapper()
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
});
