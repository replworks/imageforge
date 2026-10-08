import { serve } from '@hono/node-server';
import { readFile } from 'node:fs/promises';
import { createIdentityVerifier } from './access.js';
import { createApp } from './app.js';
import { loadConfig } from './config.js';
import { executePurgeCommand } from './purge.js';

const config = loadConfig(process.env);
const landingDocument = await readFile(
  new URL('../index.html', import.meta.url),
  'utf8',
);
const purgeDocument = await readFile(
  new URL('../dist/purge/index.html', import.meta.url),
  'utf8',
);
const verifyIdentity = createIdentityVerifier(
  config.cfAccessTeamDomain,
  config.cfAccessAud,
);
const app = createApp(
  landingDocument,
  purgeDocument,
  verifyIdentity,
  config.services,
  (command) =>
    executePurgeCommand(
      command,
      config.imageHost,
      config.services,
      config.cfZoneId,
      config.cfApiToken,
    ),
);

serve({
  fetch: app.fetch,
  port: config.port,
});
