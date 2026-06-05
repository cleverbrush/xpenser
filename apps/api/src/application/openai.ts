import type { Config } from '../config.js';

const openaiResponsesUrl = 'https://api.openai.com/v1/responses';

export class OpenAIConfigError extends Error {}

type StructuredJsonOptions = {
    readonly input: unknown;
    readonly model: string;
    readonly schema: unknown;
    readonly schemaName: string;
    readonly system: string;
};

type InputContentPart =
    | {
          readonly text: string;
          readonly type: 'input_text';
      }
    | {
          readonly detail?: 'auto' | 'high' | 'low' | 'original';
          readonly image_url: string;
          readonly type: 'input_image';
      };

type StructuredJsonContentOptions = Omit<StructuredJsonOptions, 'input'> & {
    readonly content: readonly InputContentPart[];
};

function responseOutputText(json: unknown): string {
    if (
        typeof json === 'object' &&
        json !== null &&
        'output_text' in json &&
        typeof json.output_text === 'string'
    ) {
        return json.output_text;
    }

    const output =
        typeof json === 'object' && json !== null && 'output' in json
            ? json.output
            : undefined;
    if (!Array.isArray(output)) {
        return '';
    }

    for (const item of output) {
        const content =
            typeof item === 'object' && item !== null && 'content' in item
                ? item.content
                : undefined;
        if (!Array.isArray(content)) {
            continue;
        }
        for (const part of content) {
            if (
                typeof part === 'object' &&
                part !== null &&
                'text' in part &&
                typeof part.text === 'string'
            ) {
                return part.text;
            }
        }
    }
    return '';
}

export async function generateStructuredJson<T>(
    config: Config,
    options: StructuredJsonOptions
): Promise<T> {
    return generateStructuredJsonFromContent(config, {
        content: [
            {
                type: 'input_text',
                text: JSON.stringify(options.input)
            }
        ],
        model: options.model,
        schema: options.schema,
        schemaName: options.schemaName,
        system: options.system
    });
}

export async function generateStructuredJsonFromContent<T>(
    config: Config,
    options: StructuredJsonContentOptions
): Promise<T> {
    if (!config.openai.apiKey) {
        throw new OpenAIConfigError('OPENAI_API_KEY is not set.');
    }

    const response = await fetch(openaiResponsesUrl, {
        body: JSON.stringify({
            input: [
                {
                    role: 'system',
                    content: [
                        {
                            type: 'input_text',
                            text: options.system
                        }
                    ]
                },
                {
                    role: 'user',
                    content: options.content
                }
            ],
            model: options.model,
            store: false,
            text: {
                format: {
                    name: options.schemaName,
                    schema: options.schema,
                    strict: true,
                    type: 'json_schema'
                }
            }
        }),
        headers: {
            Authorization: `Bearer ${config.openai.apiKey}`,
            'Content-Type': 'application/json'
        },
        method: 'POST'
    });

    if (!response.ok) {
        throw new Error(
            `OpenAI API error ${response.status}: ${await response.text()}`
        );
    }

    const text = responseOutputText(await response.json());
    if (!text) {
        throw new Error('OpenAI response did not contain output text.');
    }

    return JSON.parse(text) as T;
}
