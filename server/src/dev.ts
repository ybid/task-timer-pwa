import { serve } from '@hono/node-server';
import { buildApp, Bindings } from './index';
import { createLocalKV } from './kv';

/**
 * Local Node dev server. Uses the file-backed KV so sync state persists across
 * restarts. Run with `npm run dev` (or `npm start`). Point the PWA at it by
 * setting VITE_SYNC_API_BASE=http://localhost:8787 in the web app's .env.
 */
const kv = createLocalKV();
const env: Bindings = {
  KV: kv,
  SYNC_SECRET: process.env.SYNC_SECRET || 'dev-secret-change-me',
};
const app = buildApp();

const port = Number(process.env.PORT || 8787);
serve(
  {
    fetch: (req: Request) => app.fetch(req, env),
    port,
  },
  (info) => {
    console.log(`task-timer-sync listening on http://localhost:${info.port}`);
  },
);
