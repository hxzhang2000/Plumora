import { defineConfig } from 'vitest/config';
import { alias } from './build/aliases';

export default defineConfig({
  resolve: { alias },
  test: {
    environment: 'node',
    include: ['test/**/*.test.ts'],
  },
});
