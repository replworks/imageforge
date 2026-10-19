import { fileURLToPath } from 'node:url';
import tailwindcss from '@tailwindcss/vite';
import { loadEnv } from 'vite';
import { defineConfig } from 'vitest/config';

export default defineConfig(({ mode, command }) => {
  const env = loadEnv(mode, process.cwd(), '');
  const backendOrigin = `http://localhost:${env.PORT ?? '3000'}`;

  return {
    // The dev server mounts everything under `base`, so a request to
    // /purge/index.html would resolve to the root index.html instead of
    // purge/index.html. Production serves purge/index.html directly from
    // the Hono server, so base only needs to be /purge/ for the build.
    base: command === 'build' ? '/purge/' : '/',
    plugins: [tailwindcss()],
    server: {
      proxy: {
        '/purge/catalog': backendOrigin,
        '/purge/execute': backendOrigin,
      },
    },
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
  };
});
