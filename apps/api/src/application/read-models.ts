import type { Knex } from 'knex';

/**
 * Prepare immutable queries and mapper registrations once for each connection.
 * Only definitions are cached: callers add user/budget predicates on new branches.
 * Transaction connections have their own entries and are not retained strongly.
 */
export function perConnection<T extends object>(create: (knex: Knex) => T) {
    const models = new WeakMap<Knex, T>();
    return (knex: Knex): T => {
        let model = models.get(knex);
        if (!model) {
            model = create(knex);
            models.set(knex, model);
        }
        return model;
    };
}
