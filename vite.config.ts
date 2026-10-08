import tailwindcss from '@tailwindcss/vite';
import { defineConfig } from 'vitest/config';

export default defineConfig({
  base: '/purge/',
  plugins: [tailwindcss()],
  test: {
    environment: 'node',
  },
});
