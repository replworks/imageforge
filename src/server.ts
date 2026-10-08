import { serve } from '@hono/node-server';
import { readFile } from 'node:fs/promises';
import { createApp } from './app.js';
import { loadConfig } from './config.js';

const config = loadConfig(process.env);
const landingDocument = await readFile(
  new URL('../index.html', import.meta.url),
  'utf8',
);
const app = createApp(landingDocument);

serve({
  fetch: app.fetch,
  port: config.port,
});
