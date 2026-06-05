import { afterEach, describe, expect, it, vi } from 'vitest';
import type { Config } from '../config.js';
import {
    generateStructuredJson,
    generateStructuredJsonFromContent,
    OpenAIConfigError
} from './openai.js';

const config = {
    openai: {
        apiKey: 'sk-test',
        reportModel: 'gpt-5-mini',
        transactionScanModel: 'gpt-5.5'
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
        expect(
            JSON.parse(String(fetchSpy.mock.calls[0]?.[1]?.body))
        ).toMatchObject({
            store: false,
            text: {
                format: {
                    name: 'test_schema',
                    strict: true,
                    type: 'json_schema'
                }
            }
        });
    });

    it('requests structured JSON with image input content', async () => {
        const fetchSpy = vi.spyOn(globalThis, 'fetch').mockResolvedValue({
            ok: true,
            json: () =>
                Promise.resolve({
                    output_text: JSON.stringify({ count: 2 })
                })
        } as Response);

        await expect(
            generateStructuredJsonFromContent<{ count: number }>(config, {
                content: [
                    { type: 'input_text', text: 'Extract transactions.' },
                    {
                        type: 'input_image',
                        image_url: 'data:image/png;base64,abc',
                        detail: 'original'
                    }
                ],
                model: config.openai.reportModel,
                schema: {
                    type: 'object',
                    properties: { count: { type: 'number' } },
                    required: ['count'],
                    additionalProperties: false
                },
                schemaName: 'image_schema',
                system: 'Write JSON.'
            })
        ).resolves.toEqual({ count: 2 });

        expect(
            JSON.parse(String(fetchSpy.mock.calls[0]?.[1]?.body))
        ).toMatchObject({
            input: [
                expect.any(Object),
                {
                    role: 'user',
                    content: [
                        { type: 'input_text', text: 'Extract transactions.' },
                        {
                            type: 'input_image',
                            image_url: 'data:image/png;base64,abc',
                            detail: 'original'
                        }
                    ]
                }
            ]
        });
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
