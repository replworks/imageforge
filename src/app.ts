import { Hono } from 'hono';
import { serveStatic } from '@hono/node-server/serve-static';
import type { Context, Next } from 'hono';
import type { IdentityVerifier } from './access.js';

export function createApp(
  landingDocument: string,
  purgeDocument: string,
  verifyIdentity: IdentityVerifier,
  catalog: readonly string[] = [],
): Hono {
  const app = new Hono();
  const services = catalog.filter((service) => service.trim().length > 0);

  app.get('/', (context) =>
    context.html(landingDocument, 200, {
      'Content-Type': 'text/html; charset=utf-8',
    }),
  );

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
  app.use(
    '/purge/assets/*',
    serveStatic({
      root: './dist',
      rewriteRequestPath: (path) => path.replace(/^\/purge/, ''),
    }),
  );

  return app;
}
