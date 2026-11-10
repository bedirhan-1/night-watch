// Hem middleware (edge) hem route handler (node) tarafında çalışır: yalnızca Web Crypto kullanır.
export const COOKIE = 'bk_session';

export async function sessionToken() {
  const p = process.env.APP_PASSWORD || '';
  if (!p) return '';
  const buf = await crypto.subtle.digest('SHA-256', new TextEncoder().encode(p + ':bikort-session'));
  return Array.from(new Uint8Array(buf)).map((b) => b.toString(16).padStart(2, '0')).join('');
}
