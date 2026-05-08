import { defineWorkspace } from 'vitest/config';

export default defineWorkspace([
  'packages/contract/vitest.config.ts',
  'packages/ui/vitest.config.ts',
  'apps/api/vitest.config.ts',
  'apps/web/vitest.config.ts',
]);
