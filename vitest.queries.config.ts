import { defineConfig } from 'vitest/config';
import base from './vitest.config';

export default defineConfig({
    ...base,
    test: {
        ...base.test,
        include: ['apps/api/integration/**/*.test.ts'],
        exclude: ['**/node_modules/**'],
        fileParallelism: false,
        hookTimeout: 30_000
    }
});
