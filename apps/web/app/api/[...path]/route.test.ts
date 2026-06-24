import { describe, expect, it } from 'vitest';
import { apiPath } from './route';

describe('/api public proxy route', () => {
    it.each([
        [['openapi.json'], '/openapi.json'],
        [['health'], '/health'],
        [['__batch'], '/__batch'],
        [
            ['.well-known', 'oauth-authorization-server'],
            '/.well-known/oauth-authorization-server'
        ],
        [['mcp'], '/api/mcp'],
        [['transactions'], '/api/transactions'],
        [['api', 'transactions'], '/api/transactions']
    ] as const)('maps %j to %s', (parts, expected) => {
        expect(apiPath(parts)).toBe(expected);
    });
});
