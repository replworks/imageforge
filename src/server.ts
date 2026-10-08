import { serve } from '@hono/node-server';
import { Hono } from 'hono';
import { loadConfig } from './config.js';

const config = loadConfig(process.env);
const app = new Hono();

serve({
  fetch: app.fetch,
  port: config.port,
});
