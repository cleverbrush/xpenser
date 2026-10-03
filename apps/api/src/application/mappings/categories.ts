import { mapper } from '@cleverbrush/mapper';
import { boolean, string } from '@cleverbrush/schema';
import { CategorySchema } from '@xpenser/contracts';
import { categoryRead } from '../entity-reads.js';

/** Query-derived source schema and reusable synchronous DTO mapping. */
const CategoryMappingSourceSchema = categoryRead.rowSchema
    .pick([
        'id',
        'budgetId',
        'name',
        'type',
        'kind',
        'parentId',
        'archivedAt',
        'createdAt',
        'updatedAt'
    ])
    .addProps({
        parentName: string().optional(),
        displayName: string(),
        inUse: boolean(),
        hasChildren: boolean()
    });
export const categoryMapping = mapper()
    .configure(CategoryMappingSourceSchema, CategorySchema, mapping =>
        mapping
            .for(target => target.type)
            .compute(source =>
                source.type === 'income' ? 'income' : 'expense'
            )
            .for(target => target.kind)
            .compute(source => (source.kind === 'offset' ? 'offset' : 'normal'))
            .for(target => target.parentId)
            .compute(source => source.parentId ?? null)
            .for(target => target.archivedAt)
            .compute(source => source.archivedAt ?? null)
    )
    .getSyncMapper(CategoryMappingSourceSchema, CategorySchema);
