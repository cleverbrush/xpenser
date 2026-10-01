import { mapper } from '@cleverbrush/mapper';
import { ApiKeySchema } from '@xpenser/contracts';
import { apiKeyRead } from '../entity-reads.js';
import { perConnection } from '../read-models.js';

/** Public API-key mapping cannot expose credential material. */
export const apiKeyMapping = perConnection(knex => {
    const source = apiKeyRead(knex).rowSchema;
    return mapper()
        .configure(source, ApiKeySchema, m =>
            m.for(t => t.lastUsedAt).compute(s => s.lastUsedAt ?? undefined)
        )
        .getSyncMapper(source, ApiKeySchema);
});
