export const TZ = process.env.APP_TZ || 'Europe/Istanbul';

export function today(d = new Date()) {
  return new Intl.DateTimeFormat('en-CA', { timeZone: TZ, year: 'numeric', month: '2-digit', day: '2-digit' }).format(d);
}

export function addDays(ymd, n) {
  const [y, m, d] = ymd.split('-').map(Number);
  const dt = new Date(Date.UTC(y, m - 1, d + n));
  return dt.toISOString().slice(0, 10);
}

export function isMonday(d = new Date()) {
  return new Intl.DateTimeFormat('en-US', { timeZone: TZ, weekday: 'short' }).format(d) === 'Mon';
}

export function toSnake(k) {
  return k.replace(/[A-Z]/g, (c) => '_' + c.toLowerCase());
}

export function toCamel(row) {
  const o = {};
  for (const k of Object.keys(row)) o[k.replace(/_([a-z])/g, (_, c) => c.toUpperCase())] = row[k];
  return o;
}

export function esc(v) {
  return String(v == null ? '' : v).replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
}

export async function getJson(url, headers) {
  const r = await fetch(url, { headers, cache: 'no-store' });
  if (!r.ok) {
    const t = await r.text().catch(() => '');
    throw new Error(`${new URL(url).hostname} ${r.status}: ${t.slice(0, 200)}`);
  }
  return r.json();
}
