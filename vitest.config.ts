import { defineConfig } from 'vitest/config';
import path from 'path';

export default defineConfig({
  define: {
    __APP_VERSION__: JSON.stringify(require('./package.json').version),
  },
  resolve: {
    alias: {
      '@': path.resolve(__dirname, 'src'),
    },
  },
  test: {
    css: false,
  },
});
