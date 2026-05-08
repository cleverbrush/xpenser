import { defineConfig } from 'vitest/config';
import baseConfig from '../../vitest.config.base.js';

export default defineConfig({
  ...baseConfig,
  test: {
    ...baseConfig.test,
    environment: 'node',
  },
});
