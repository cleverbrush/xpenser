import { afterEach, describe, expect, it, vi } from 'vitest';
import type { Config } from '../config.js';
import { generateStructuredJson, OpenAIConfigError } from './openai.js';

const config = {
    openai: {
        apiKey: 'sk-test',
        reportModel: 'gpt-5-mini'
    }
} as Config;

describe('generateStructuredJson', () => {
    afterEach(() => {
        vi.restoreAllMocks();
    });

    it('requests structured JSON from the Responses API', async () => {
        const fetchSpy = vi.spyOn(globalThis, 'fetch').mockResolvedValue({
            ok: true,
            json: () =>
                Promise.resolve({
                    output_text: JSON.stringify({ headline: 'Good month' })
                })
        } as Response);

        await expect(
            generateStructuredJson<{ headline: string }>(config, {
                input: { amount: 12 },
                model: config.openai.reportModel,
                schema: {
                    type: 'object',
                    properties: { headline: { type: 'string' } },
                    required: ['headline'],
                    additionalProperties: false
                },
                schemaName: 'test_schema',
                system: 'Write JSON.'
            })
        ).resolves.toEqual({ headline: 'Good month' });

        expect(fetchSpy).toHaveBeenCalledWith(
            'https://api.openai.com/v1/responses',
            expect.objectContaining({
                method: 'POST',
                headers: expect.objectContaining({
                    Authorization: 'Bearer sk-test'
                })
            })
        );
    });

    it('throws when OpenAI is not configured', async () => {
        await expect(
            generateStructuredJson({ openai: {} } as Config, {
                input: {},
                model: 'gpt-5-mini',
                schema: {},
                schemaName: 'x',
                system: 'x'
            })
        ).rejects.toBeInstanceOf(OpenAIConfigError);
    });
});
