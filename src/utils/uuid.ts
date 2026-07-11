/**
 * Safe UUID generator.
 *
 * `crypto.randomUUID()` only exists in secure contexts (https or localhost).
 * The app is documented to run on the iPad over a plain `http://<LAN-IP>:3000`
 * connection, where `crypto.randomUUID` is `undefined` and would throw,
 * blanking the whole app. This helper falls back gracefully.
 */
export function uuid(): string {
  const c: Crypto | undefined = globalThis.crypto;
  if (c && typeof c.randomUUID === 'function') {
    try {
      return c.randomUUID();
    } catch {
      /* fall through to fallback */
    }
  }

  // RFC-4122 v4 using getRandomValues when available
  if (c && typeof c.getRandomValues === 'function') {
    const arr = new Uint8Array(16);
    c.getRandomValues(arr);
    arr[6] = (arr[6] & 0x0f) | 0x40;
    arr[8] = (arr[8] & 0x3f) | 0x80;
    const hex = Array.from(arr, (b) => b.toString(16).padStart(2, '0'));
    return (
      hex.slice(0, 4).join('') +
      '-' +
      hex.slice(4, 6).join('') +
      '-' +
      hex.slice(6, 8).join('') +
      '-' +
      hex.slice(8, 10).join('') +
      '-' +
      hex.slice(10, 16).join('')
    );
  }

  // Last-resort Math.random fallback
  return 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, (ch) => {
    const r = (Math.random() * 16) | 0;
    const v = ch === 'x' ? r : (r & 0x3) | 0x8;
    return v.toString(16);
  });
}
