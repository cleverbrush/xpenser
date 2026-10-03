import { mapper } from '@cleverbrush/mapper';
import { ApiKeySchema } from '@xpenser/contracts';
import { apiKeyRead } from '../entity-reads.js';

/** Public API-key mapping cannot expose credential material. */
const source = apiKeyRead.rowSchema;
export const apiKeyMapping = mapper()
    .configure(source, ApiKeySchema, m =>
        m.for(t => t.lastUsedAt).compute(s => s.lastUsedAt ?? undefined)
    )
    .getSyncMapper(source, ApiKeySchema);
