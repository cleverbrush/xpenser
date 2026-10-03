import { mapper } from '@cleverbrush/mapper';
import { string } from '@cleverbrush/schema';
import { UserAvatarSummarySchema } from '@xpenser/contracts';
import { userAvatarRead } from '../entity-reads.js';

const avatarPath = (id: number) => `/app-api/users/${id}/avatar`;
const UserAvatarSummarySourceSchema = userAvatarRead.rowSchema.addProps({
    displayName: string().optional()
});
export const userAvatarMapping = mapper()
    .configure(
        UserAvatarSummarySourceSchema,
        UserAvatarSummarySchema,
        mapping =>
            mapping
                .for(target => target.userId)
                .from(source => source.id)
                .for(target => target.avatarUrl)
                .compute(source =>
                    source.avatarImageMimeType
                        ? avatarPath(source.id)
                        : (source.avatarUrl ?? undefined)
                )
    )
    .getSyncMapper(UserAvatarSummarySourceSchema, UserAvatarSummarySchema);
