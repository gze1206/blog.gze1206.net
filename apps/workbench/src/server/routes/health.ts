import { Hono } from 'hono';

export function createHealthRoutes(): Hono {
  const app = new Hono();

  app.get('/api/health', (context) => {
    context.header('Cache-Control', 'no-store');
    return context.json({ status: 'ready' as const });
  });

  return app;
}
