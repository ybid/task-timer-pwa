/**
 * Account-based auth for the public sync API.
 *
 * A user registers with a username + password. The server stores a salted
 * PBKDF2 hash in KV keyed by username, and returns an HMAC-signed token whose
 * payload is the stable `accountId`. All sync data is namespaced by `accountId`
 * so every device signed into the same account shares one dataset.
 *
 * Stateless: token verification only needs the shared secret, so it runs on
 * Cloudflare Workers with no session store.
 */

import type { KV } from './kv';

const encoder = new TextEncoder();

function getSecret(secret: string): string {
  return secret || 'dev-secret-change-me';
}

async function importKey(secret: string): Promise<CryptoKey> {
  return crypto.subtle.importKey(
    'raw',
    encoder.encode(getSecret(secret)) as BufferSource,
    { name: 'HMAC', hash: 'SHA-256' },
    false,
    ['sign', 'verify'],
  );
}

function toBase64Url(bytes: Uint8Array): string {
  let bin = '';
  for (const b of bytes) bin += String.fromCharCode(b);
  return btoa(bin).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');
}

function fromBase64Url(s: string): Uint8Array<ArrayBuffer> {
  const b64 = s.replace(/-/g, '+').replace(/_/g, '/');
  const bin = atob(b64);
  const out = new Uint8Array(bin.length);
  for (let i = 0; i < bin.length; i++) out[i] = bin.charCodeAt(i);
  return out;
}

/** Sign an account id into a token: `<accountId>.<signature>`. */
export async function signAccount(accountId: string, secret: string): Promise<string> {
  const key = await importKey(secret);
  const sig = new Uint8Array(await crypto.subtle.sign('HMAC', key, encoder.encode(accountId) as BufferSource));
  return `${accountId}.${toBase64Url(sig)}`;
}

/** Verify a token and return the account id, or null if invalid. */
export async function verifyAccount(token: string | null, secret: string): Promise<string | null> {
  if (!token) return null;
  const parts = token.split('.');
  if (parts.length !== 2) return null;
  const [accountId, providedSig] = parts;
  try {
    const key = await importKey(secret);
    const expected = new Uint8Array(await crypto.subtle.sign('HMAC', key, encoder.encode(accountId) as BufferSource));
    const provided = fromBase64Url(providedSig);
    if (expected.length !== provided.length) return null;
    let ok = true;
    for (let i = 0; i < expected.length; i++) {
      if (expected[i] !== provided[i]) ok = false;
    }
    return ok ? accountId : null;
  } catch {
    return null;
  }
}

// ─── password hashing (PBKDF2-SHA256) ───

const PBKDF2_ITERATIONS = 100_000;

async function hashPassword(password: string, salt: Uint8Array<ArrayBuffer>): Promise<string> {
  const material = await crypto.subtle.importKey('raw', encoder.encode(password), 'PBKDF2', false, [
    'deriveBits',
  ]);
  const bits = await crypto.subtle.deriveBits(
    { name: 'PBKDF2', salt, iterations: PBKDF2_ITERATIONS, hash: 'SHA-256' },
    material,
    256,
  );
  return toBase64Url(new Uint8Array(bits));
}

export interface AccountRecord {
  accountId: string;
  /** base64url salt */
  salt: string;
  /** base64url PBKDF2 hash */
  passwordHash: string;
}

type AuthOk = { ok: true; accountId: string; token: string };
type AuthErr = { ok: false; error: string; status: AuthStatus };
/** HTTP status codes this module emits (a subset of Hono's ContentfulStatusCode). */
export type AuthStatus = 400 | 401 | 409 | 500;

export type AuthResult = AuthOk | AuthErr;

function ok(accountId: string, token: string): AuthOk {
  return { ok: true, accountId, token };
}
function err(error: string, status: AuthStatus): AuthErr {
  return { ok: false, error, status };
}

/** Register a new account. Fails if the username already exists (409). */
export async function registerAccount(
  kv: KV,
  username: string,
  password: string,
  secret: string,
): Promise<AuthResult> {
  if (!username || !password) return err('用户名和密码不能为空', 400);
  if (username.length < 3) return err('用户名至少 3 个字符', 400);
  if (password.length < 6) return err('密码至少 6 个字符', 400);

  const key = `auth:${username}`;
  if (await kv.get(key)) return err('账号已存在，请直接登录', 409);

  const accountId = crypto.randomUUID();
  const salt = crypto.getRandomValues(new Uint8Array(16));
  const passwordHash = await hashPassword(password, salt);
  const rec: AccountRecord = { accountId, salt: toBase64Url(salt), passwordHash };
  await kv.put(key, JSON.stringify(rec));

  const token = await signAccount(accountId, secret);
  return ok(accountId, token);
}

/** Verify credentials and return a token. Fails with 401 on bad username/password. */
export async function loginAccount(
  kv: KV,
  username: string,
  password: string,
  secret: string,
): Promise<AuthResult> {
  if (!username || !password) return err('用户名和密码不能为空', 400);

  const raw = await kv.get(`auth:${username}`);
  if (!raw) return err('账号不存在，请先注册', 401);

  let rec: AccountRecord;
  try {
    rec = JSON.parse(raw) as AccountRecord;
  } catch {
    return err('服务端数据损坏', 500);
  }

  const salt = fromBase64Url(rec.salt);
  const hash = await hashPassword(password, salt);
  if (hash !== rec.passwordHash) return err('密码错误', 401);

  const token = await signAccount(rec.accountId, secret);
  return ok(rec.accountId, token);
}
