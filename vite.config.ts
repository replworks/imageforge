import { fileURLToPath } from 'node:url';
import tailwindcss from '@tailwindcss/vite';
import { defineConfig } from 'vitest/config';

export default defineConfig({
  base: '/purge/',
  plugins: [tailwindcss()],
  build: {
    rollupOptions: {
      input: {
        purge: fileURLToPath(new URL('./purge/index.html', import.meta.url)),
      },
    },
  },
  test: {
    environment: 'node',
    include: ['src/**/*.test.ts'],
  },
});
