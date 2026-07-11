#!/usr/bin/env node
/**
 * One-command deploy for the task-timer-sync Worker.
 *
 * What it does (in this exact order):
 *   1. Ensures a Cloudflare KV namespace exists (creates one on first run and
 *      writes its id into wrangler.toml).
 *   2. Ensures a workers.dev subdomain is registered for your account (one-time,
 *      globally unique — the script asks you for a name and registers it).
 *      Without this, `wrangler deploy` fails with "register a workers.dev
 *      subdomain".
 *   3. Deploys the Worker (so it exists on the account — required before a
 *      secret can be attached).
 *   4. Generates a random SYNC_SECRET and stores it as a Cloudflare secret
 *      (only if one isn't already set — avoids invalidating issued device
 *      tokens on every redeploy). The value is fed via stdin, because wrangler
 *      no longer accepts the `--value` flag.
 *
 * Prerequisites (the only human steps):
 *   - A free Cloudflare account (email signup, no card needed for Workers free).
 *   - `npx wrangler login` run once on your machine (opens your browser to
 *     authorize the CLI against YOUR account).
 *
 * Usage:  node scripts/deploy.mjs   (or: npm run deploy:setup)
 */
import { execSync } from 'node:child_process';
import { randomBytes } from 'node:crypto';
import { readFileSync, writeFileSync } from 'node:fs';
import readline from 'node:readline';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const root = path.resolve(__dirname, '..');
const tomlPath = path.join(root, 'wrangler.toml');

function run(cmd, opts = {}) {
  console.log(`$ ${cmd}`);
  return execSync(cmd, { cwd: root, stdio: 'inherit', ...opts });
}
function runCapture(cmd) {
  return execSync(cmd, { cwd: root }).toString();
}
// Run a command and feed `input` to its stdin (used for non-interactive secrets).
function runInput(cmd, input) {
  console.log(`$ ${cmd}  (value via stdin)`);
  return execSync(cmd, { cwd: root, stdio: ['pipe', 'inherit', 'inherit'], input });
}
// Run a command with piped stdio; never throws — returns { ok, out }. Used to
// probe outcomes (e.g. deploy) without crashing the script.
function runResult(cmd) {
  try {
    const out = execSync(cmd, { cwd: root, stdio: ['pipe', 'pipe', 'pipe'] }).toString();
    return { ok: true, out };
  } catch (e) {
    return { ok: false, out: (e.stdout?.toString() ?? '') + (e.stderr?.toString() ?? '') };
  }
}
function ask(question) {
  const rl = readline.createInterface({ input: process.stdin, output: process.stdout });
  return new Promise((resolve) => {
    rl.question(question, (ans) => {
      rl.close();
      resolve((ans ?? '').trim());
    });
  });
}

// ── 1. KV namespace ────────────────────────────────────────────────────────
let toml = readFileSync(tomlPath, 'utf8');
const idMatch = toml.match(/id\s*=\s*"([^"]+)"/);
if (!idMatch || idMatch[1].startsWith('REPLACE')) {
  console.log('→ Creating KV namespace "task-timer-sync"...');
  const out = runCapture('npx wrangler kv namespace create task-timer-sync');
  const m = out.match(/id\s*=\s*"([0-9a-fA-F]+)"/);
  if (!m) {
    console.error('Could not parse KV namespace id from wrangler output:\n' + out);
    process.exit(1);
  }
  toml = toml.replace(/id\s*=\s*"[^"]*"/, `id = "${m[1]}"`);
  writeFileSync(tomlPath, toml);
  console.log('→ Wrote KV namespace id into wrangler.toml');
} else {
  console.log('→ KV namespace already configured.');
}

// ── 2. workers.dev subdomain (one-time, account-wide) ───────────────────────
console.log('\n→ A workers.dev subdomain is required (one-time, globally unique).');
console.log('  Pick something like "yourname-tasktimer". You can also set it later');
console.log('  in the Cloudflare dashboard: Workers & Pages → your worker → Triggers.\n');
let deployed = false;
for (let attempt = 0; attempt < 5 && !deployed; attempt++) {
  const name = await ask('  Enter desired workers.dev subdomain: ');
  if (!name) {
    console.log('  (subdomain is required to continue)');
    continue;
  }
  // Registering (or re-asserting) the subdomain. Errors here are usually
  // "already registered" — we don't fail on them; the deploy probe decides.
  runResult(`npx wrangler subdomain ${name}`);
  // Probe with a real deploy. In non-interactive mode, if the subdomain is
  // still missing, wrangler auto-answers "no" and errors with a clear marker.
  const d = runResult('npx wrangler deploy');
  if (d.ok) {
    deployed = true;
    console.log('→ Worker deployed.');
  } else if (/workers\.dev subdomain/i.test(d.out)) {
    console.error(`  ✗ Subdomain "${name}" could not be used (taken or invalid). Try another.`);
  } else {
    console.error('  ✗ Deploy failed for a reason other than the subdomain:\n' + d.out);
    process.exit(1);
  }
}
if (!deployed) {
  console.error('\nGiving up after several attempts. Register a subdomain manually in the');
  console.error('Cloudflare dashboard, then re-run: npm run deploy:setup');
  process.exit(1);
}

// ── 3. SYNC_SECRET (only if not already a secret) ───────────────────────────
let hasSecret = false;
try {
  const list = JSON.parse(runCapture('npx wrangler secret list'));
  hasSecret = Array.isArray(list) && list.some((s) => s.name === 'SYNC_SECRET');
} catch {
  console.warn('  (could not list secrets — will attempt to set one anyway)');
}
if (!hasSecret) {
  const secret = randomBytes(24).toString('hex');
  console.log('→ Generating and storing SYNC_SECRET secret...');
  runInput('npx wrangler secret put SYNC_SECRET', secret + '\n');
  console.log('→ SYNC_SECRET stored.');
} else {
  console.log('→ SYNC_SECRET secret already set, keeping it.');
}

console.log('\n✓ Deploy complete.');
console.log('  Endpoint: https://task-timer-sync.<your-subdomain>.workers.dev');
console.log('  Next: set VITE_SYNC_API_BASE to that URL in the frontend .env, then rebuild.');
