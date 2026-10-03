import { mapper } from '@cleverbrush/mapper';
import { TransactionScanDraftSchema } from '@xpenser/contracts';
import { TransactionScanItemDbSchema } from '../db/schemas.js';

const source = TransactionScanItemDbSchema.introspect().properties.draft;
const target = TransactionScanDraftSchema.omit('id');
const from = source.introspect().properties;
const to = target.introspect().properties;

/** Persist extension data losslessly, but project only public fields into DTOs. */
const registry = mapper()
    .configure(from.confidence, to.confidence, mapping => mapping)
    .configure(
        from.suggestedCategory,
        to.suggestedCategory,
        mapping => mapping
    );
const category = registry.getSyncMapper(
    from.suggestedCategory,
    to.suggestedCategory
);

export const publicScanDraft = registry
    .configure(source, target, mapping =>
        mapping
            .for(row => row.suggestedCategory)
            .compute(row =>
                row.suggestedCategory === null
                    ? null
                    : category(row.suggestedCategory)
            )
    )
    .getSyncMapper(source, target);
