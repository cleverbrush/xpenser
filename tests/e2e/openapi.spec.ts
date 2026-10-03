import { expect, test } from '@playwright/test';

test.use({ storageState: { cookies: [], origins: [] } });

test('published OpenAPI preserves canonical named schema modifiers', async ({
    request
}) => {
    const response = await request.get('/api/openapi.json');
    expect(response.status()).toBe(200);
    const {
        components: { schemas }
    } = await response.json();
    for (const [parent, field, target, required, nullable] of [
        [
            'TransactionScanDraft',
            'suggestedCategory',
            'TransactionScanSuggestedCategory',
            true,
            true
        ],
        [
            'TransactionScanProgressEvent',
            'scan',
            'TransactionScanResponse',
            true,
            true
        ],
        [
            'TransactionScanDecisionBody',
            'correctedTransaction',
            'TransactionScanCorrectedTransaction',
            false,
            true
        ],
        ['StatsTagReport', 'selectedTag', 'StatsTagDetail', true, true]
    ] as const) {
        const reference = {
            allOf: [{ $ref: `#/components/schemas/${target}` }]
        };
        expect(schemas[parent].properties[field]).toMatchObject(
            nullable ? { anyOf: [reference, { type: 'null' }] } : reference
        );
        expect(schemas[parent].properties[field].description).toBeTruthy();
        expect(schemas[parent].required.includes(field)).toBe(required);
        expect(schemas[target].type).toBe('object');
    }
});
