/**
 * Device-token auth. No email/password — a device authenticates with a stable
 * `deviceId` and receives an HMAC-signed token it sends as a Bearer header.
 * Stateless: the server only needs the shared secret to verify, so it works in
 * a serverless (Cloudflare Workers) context with no session store.
 */

const encoder = new TextEncoder();

function getSecret(secret: string): string {
  return secret || 'dev-secret-change-me';
}

async function importKey(secret: string): Promise<CryptoKey> {
  return crypto.subtle.importKey(
    'raw',
    encoder.encode(getSecret(secret)),
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

function fromBase64Url(s: string): Uint8Array {
  const b64 = s.replace(/-/g, '+').replace(/_/g, '/');
  const bin = atob(b64);
  const out = new Uint8Array(bin.length);
  for (let i = 0; i < bin.length; i++) out[i] = bin.charCodeAt(i);
  return out;
}

/** Create a signed token for a device id: `<deviceId>.<signature>`. */
export async function signDevice(deviceId: string, secret: string): Promise<string> {
  const key = await importKey(secret);
  const sig = new Uint8Array(await crypto.subtle.sign('HMAC', key, encoder.encode(deviceId)));
  return `${deviceId}.${toBase64Url(sig)}`;
}

/** Verify a token and return the device id, or null if invalid. */
export async function verifyToken(token: string | null, secret: string): Promise<string | null> {
  if (!token) return null;
  const parts = token.split('.');
  if (parts.length !== 2) return null;
  const [deviceId, providedSig] = parts;
  try {
    const key = await importKey(secret);
    const expected = new Uint8Array(await crypto.subtle.sign('HMAC', key, encoder.encode(deviceId)));
    const provided = fromBase64Url(providedSig);
    if (expected.length !== provided.length) return null;
    let ok = true;
    for (let i = 0; i < expected.length; i++) {
      if (expected[i] !== provided[i]) ok = false;
    }
    return ok ? deviceId : null;
  } catch {
    return null;
  }
}
