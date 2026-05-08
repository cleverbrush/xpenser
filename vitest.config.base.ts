import { defineConfig } from 'vitest/config';

export default defineConfig({
  test: {
    include: ['src/**/*.test.ts', 'src/**/*.test.tsx'],
    coverage: {
      provider: 'v8',
      reporter: ['text', 'lcov'],
      exclude: [
        'node_modules',
        'dist',
        '.next',
        '.turbo',
        '**/*.config.*',
        '**/*.d.ts',
      ],
    },
    typecheck: {
      enabled: true,
    },
  },
});
