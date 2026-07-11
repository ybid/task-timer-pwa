import { buildApp, Bindings } from './index';
import type { ExecutionContext } from 'hono';

/**
 * Cloudflare Workers entry. The KV binding defined in wrangler.toml is exposed
 * on `env.KV`; `SYNC_SECRET` is a secret/variable. Deploy with `npm run deploy`.
 */
const app = buildApp();

export default {
  fetch(req: Request, env: Bindings, ctx: ExecutionContext) {
    return app.fetch(req, env, ctx);
  },
};
