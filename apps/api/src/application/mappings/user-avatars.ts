import { mapper } from '@cleverbrush/mapper';
import { string } from '@cleverbrush/schema';
import { UserAvatarSummarySchema } from '@xpenser/contracts';
import { userAvatarRead } from '../entity-reads.js';
import { perConnection } from '../read-models.js';

const avatarPath = (id: number) => `/app-api/users/${id}/avatar`;
export const userAvatarMapping = perConnection(knex => {
    const UserAvatarSummarySourceSchema = userAvatarRead(
        knex
    ).rowSchema.addProps({ displayName: string().optional() });
    return mapper()
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
});
