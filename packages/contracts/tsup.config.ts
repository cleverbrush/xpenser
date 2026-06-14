import { defineConfig } from 'tsup';

export default defineConfig({
    entry: [
        'src/index.ts',
        'src/api.ts',
        'src/hosted-auth.ts',
        'src/schemas.ts',
        'src/session.ts'
    ],
    format: ['esm'],
    dts: true,
    sourcemap: true,
    clean: true,
    target: 'es2022',
    external: [/^@cleverbrush\//]
});
