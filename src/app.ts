import { Hono } from 'hono';

export function createApp(landingDocument: string): Hono {
  const app = new Hono();

  app.get('/', (context) =>
    context.html(landingDocument, 200, {
      'Content-Type': 'text/html; charset=utf-8',
    }),
  );

  app.get('/health', (context) => context.body(null, 200));

  const denyProtectedRequest = (context: {
    body: (data: null, status: 401) => Response;
  }) => context.body(null, 401);

  app.all('/purge', denyProtectedRequest);
  app.all('/purge/*', denyProtectedRequest);

  return app;
}
