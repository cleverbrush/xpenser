import { defineConfig } from 'tsup';

export default defineConfig({
    entry: ['src/index.ts', 'src/telemetry.ts'],
    format: ['esm'],
    tsconfig: './tsconfig.json',
    minify: false,
    sourcemap: true,
    clean: true,
    target: 'node22',
    noExternal: [/@xpenser\//],
    external: ['ws', /^@opentelemetry\//, '@fastify/busboy']
});
