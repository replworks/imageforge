import { Hono } from 'hono';
import { serveStatic } from '@hono/node-server/serve-static';
import type { Context, Next } from 'hono';
import type { IdentityVerifier } from './access.js';
import type { PurgeCommand, PurgeExecutionResult } from './purge.js';

export type PurgeExecutor = (
  command: PurgeCommand,
) => Promise<PurgeExecutionResult>;

export function createApp(
  landingDocument: string,
  purgeDocument: string,
  verifyIdentity: IdentityVerifier,
  catalog: readonly string[] = [],
  executePurge: PurgeExecutor = async () => ({
    ok: false,
    errors: ['Purge execution is not configured'],
  }),
  ogImage?: Uint8Array<ArrayBuffer> | null,
): Hono {
  const app = new Hono();
  const services = catalog.filter((service) => service.trim().length > 0);

  app.get('/', (context) =>
    context.html(landingDocument, 200, {
      'Content-Type': 'text/html; charset=utf-8',
    }),
  );

  if (ogImage) {
    app.get(
      '/og.png',
      (context) =>
        context.body(ogImage.buffer, 200, {
          'Content-Type': 'image/png',
          'Cache-Control': 'public, max-age=86400',
        }),
    );
  }

  app.get('/health', (context) => context.body(null, 200));

  const protect = async (
    context: Context,
    next: Next,
  ) => {
    let allowed: boolean;
    try {
      allowed = await verifyIdentity(context.req.raw);
    } catch {
      allowed = false;
    }

    if (!allowed) {
      return context.body(null, 401);
    }

    await next();
  };

  app.use('/purge', protect);
  app.use('/purge/*', protect);

  app.get('/purge', (context) => context.redirect('/purge/'));
  app.get('/purge/', (context) => context.html(purgeDocument));
  app.get('/purge/catalog', (context) => context.json({ services }));
  app.post('/purge/execute', async (context) => {
    try {
      const command = (await context.req.json()) as Partial<PurgeCommand>;
      const result = await executePurge(command as PurgeCommand);

      if (!result.ok) {
        return context.json(result, 400);
      }

      return context.json(result, 200);
    } catch {
      return context.json(
        {
          ok: false,
          errors: ['Invalid purge request payload'],
        },
        400,
      );
    }
  });
  app.use(
    '/purge/assets/*',
    serveStatic({
      root: './dist',
      rewriteRequestPath: (path) => path.replace(/^\/purge/, ''),
    }),
  );

  return app;
}
