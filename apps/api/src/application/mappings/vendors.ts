import { mapper } from '@cleverbrush/mapper';
import { array, number, object, string } from '@cleverbrush/schema';
import { UserAvatarSummarySchema, VendorSchema } from '@xpenser/contracts';
import { vendorRead } from '../entity-reads.js';

/** Query-derived source schema and reusable synchronous DTO mapping. */
const VendorMappingSourceSchema = object({
    vendor: vendorRead.rowSchema,
    suggestion: object({
        categoryId: number(),
        categoryDisplayName: string()
    }).optional(),
    transactionCount: number(),
    contributors: array(UserAvatarSummarySchema),
    otherContributorCount: number()
});
export const vendorMapping = mapper()
    .configure(VendorMappingSourceSchema, VendorSchema, mapping =>
        mapping
            .for(target => target.id)
            .from(source => source.vendor.id)
            .for(target => target.budgetId)
            .from(source => source.vendor.budgetId)
            .for(target => target.name)
            .from(source => source.vendor.name)
            .for(target => target.displayName)
            .from(source => source.vendor.name)
            .for(target => target.resolvedName)
            .compute(source => source.vendor.resolvedName ?? undefined)
            .for(target => target.domain)
            .compute(source => source.vendor.domain ?? undefined)
            .for(target => target.description)
            .compute(source => source.vendor.description ?? undefined)
            .for(target => target.logoUrl)
            .compute(source => source.vendor.logoUrl ?? undefined)
            .for(target => target.primaryColor)
            .compute(source => source.vendor.primaryColor ?? undefined)
            .for(target => target.enrichmentProvider)
            .compute(source => source.vendor.enrichmentProvider ?? undefined)
            .for(target => target.enrichmentStatus)
            .compute(source => {
                const status = source.vendor.enrichmentStatus;
                if (
                    status === 'disabled' ||
                    status === 'success' ||
                    status === 'not_found' ||
                    status === 'failed'
                ) {
                    return status;
                }
                return undefined;
            })
            .for(target => target.enrichedAt)
            .compute(source => source.vendor.enrichedAt ?? undefined)
            .for(target => target.suggestedCategoryId)
            .compute(source => source.suggestion?.categoryId)
            .for(target => target.suggestedCategoryDisplayName)
            .compute(source => source.suggestion?.categoryDisplayName)
            .for(target => target.createdAt)
            .from(source => source.vendor.createdAt)
            .for(target => target.updatedAt)
            .from(source => source.vendor.updatedAt)
    )
    .getSyncMapper(VendorMappingSourceSchema, VendorSchema);
