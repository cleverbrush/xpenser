import { defineConfig } from 'vitest/config';

export default defineConfig({
    test: {
        globals: true,
        environment: 'node',
        include: [
            'apps/**/*.test.ts',
            'apps/**/*.test.tsx',
            'packages/**/*.test.ts',
            'packages/**/*.test.tsx',
            'scripts/**/*.test.mjs'
        ],
        coverage: {
            provider: 'v8'
        }
    }
});
