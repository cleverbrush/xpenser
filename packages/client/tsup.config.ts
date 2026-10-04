import { defineConfig } from 'tsup';

export default defineConfig({
    entry: ['src/index.ts', 'src/transaction-save.ts'],
    format: ['esm'],
    sourcemap: true,
    clean: true,
    target: 'es2022',
    external: [/^@cleverbrush\//, /^@xpenser\//]
});
