import { Hono } from 'hono';
import type { KV } from './kv';
import { signAccount, verifyAccount, registerAccount, loginAccount } from './auth';
import { applyChanges, getChangesSince, SyncChange } from './store';

export interface Bindings {
  /** Provided by Cloudflare KV binding in prod, or injected locally in dev. */
  KV?: KV;
  /** Shared secret used to sign device tokens. Set via secret/variable. */
  SYNC_SECRET?: string;
}

function secretOf(c: { env?: Bindings }): string {
  return c.env?.SYNC_SECRET || 'dev-secret-change-me';
}

function bearer(c: { req: { header(name: string): string | undefined } }): string | null {
  const auth = c.req.header('Authorization');
  if (auth && auth.startsWith('Bearer ')) return auth.slice(7);
  return null;
}

/** Build the sync API Hono app. Shared by the Node dev server and Workers. */
export function buildApp(): Hono<{ Bindings: Bindings }> {
  const app = new Hono<{ Bindings: Bindings }>();

  // CORS — needed when the PWA dev server and the sync API are on different
  // origins (e.g. localhost:5173 <-> localhost:8787). When deployed on the same
  // origin as the PWA, these are harmless.
  app.use('*', async (c, next) => {
    c.header('Access-Control-Allow-Origin', '*');
    c.header('Access-Control-Allow-Methods', 'GET, POST, OPTIONS');
    c.header('Access-Control-Allow-Headers', 'Content-Type, Authorization');
    // IMPORTANT: return through the Hono context (c.text) so the CORS headers
    // set above are carried on the preflight response. A bare `new Response()`
    // would drop them and the browser would fail the preflight → CORS error.
    if (c.req.method === 'OPTIONS') {
      c.status(204);
      return c.body(null);
    }
    await next();
  });

  app.get('/', (c) => c.json({ ok: true, service: 'task-timer-sync' }));

  // Require a usable KV only for the sync routes.
  app.use('/api/*', async (c, next) => {
    if (!c.env?.KV) {
      return c.json({ error: 'KV not configured' }, 500);
    }
    await next();
  });

  // POST /api/auth/register  ->  { token, accountId }
  app.post('/api/auth/register', async (c) => {
    const body = await c.req
      .json<{ username?: string; password?: string }>()
      .catch(() => ({ username: undefined, password: undefined }));
    const res = await registerAccount(
      c.env.KV as KV,
      body.username ?? '',
      body.password ?? '',
      secretOf(c),
    );
    if (!res.ok) return c.json({ error: res.error }, res.status);
    return c.json({ token: res.token, accountId: res.accountId });
  });

  // POST /api/auth/login  ->  { token, accountId }
  app.post('/api/auth/login', async (c) => {
    const body = await c.req
      .json<{ username?: string; password?: string }>()
      .catch(() => ({ username: undefined, password: undefined }));
    const res = await loginAccount(
      c.env.KV as KV,
      body.username ?? '',
      body.password ?? '',
      secretOf(c),
    );
    if (!res.ok) return c.json({ error: res.error }, res.status);
    return c.json({ token: res.token, accountId: res.accountId });
  });

  // POST /api/sync  ->  { now }
  app.post('/api/sync', async (c) => {
    const token = bearer(c);
    const accountId = await verifyAccount(token, secretOf(c));
    if (!accountId) return c.json({ error: 'unauthorized' }, 401);

    const body = await c.req
      .json<{ changes?: SyncChange[] }>()
      .catch(() => ({ changes: [] as SyncChange[] }));
    const changes = Array.isArray(body.changes) ? body.changes : [];
    await applyChanges(c.env.KV as KV, accountId, changes);
    return c.json({ now: new Date().toISOString() });
  });

  // GET /api/sync?since=<iso>  ->  { changes, now }
  app.get('/api/sync', async (c) => {
    const token = bearer(c);
    const accountId = await verifyAccount(token, secretOf(c));
    if (!accountId) return c.json({ error: 'unauthorized' }, 401);

    const since = c.req.query('since') || null;
    const changes = await getChangesSince(c.env.KV as KV, accountId, since);
    return c.json({ changes, now: new Date().toISOString() });
  });

  return app;
}
