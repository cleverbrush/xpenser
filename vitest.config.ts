import { defineConfig } from 'vitest/config';

export default defineConfig({
    resolve: {
        alias: {
            '@': new URL('./apps/web', import.meta.url).pathname,
            '@xpenser/contracts/session': new URL(
                './packages/contracts/src/session.ts',
                import.meta.url
            ).pathname,
            '@xpenser/contracts/hosted-auth': new URL(
                './packages/contracts/src/hosted-auth.ts',
                import.meta.url
            ).pathname,
            '@xpenser/contracts': new URL(
                './packages/contracts/src/index.ts',
                import.meta.url
            ).pathname,
            '@xpenser/timezone': new URL(
                './packages/timezone/src/index.ts',
                import.meta.url
            ).pathname,
            '@xpenser/ui': new URL(
                './packages/ui/src/index.ts',
                import.meta.url
            ).pathname
        },
        dedupe: ['react', 'react-dom']
    },
    oxc: {
        jsx: {
            importSource: 'react',
            runtime: 'automatic'
        }
    },
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
