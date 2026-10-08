import { Hono } from 'hono';

export function createApp(landingDocument: string): Hono {
  const app = new Hono();

  app.get('/', (context) =>
    context.html(landingDocument, 200, {
      'Content-Type': 'text/html; charset=utf-8',
    }),
  );

  return app;
}
