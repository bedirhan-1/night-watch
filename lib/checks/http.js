// Sağlık kontrolü: yazılan adreslere istek atar; yanıt gelmezse ya da 400 ve üstü dönerse kayıt açar,
// adres yeniden yanıt verince kaydı kapatır.
const TIMEOUT_MS = 10000;
const MAX_URLS = 10;

export function parseUrls(text) {
  return String(text || '')
    .split(/[\n,]+/)
    .map((s) => s.trim())
    .filter(Boolean)
    .slice(0, MAX_URLS);
}

// Yalnızca dışarıya açık http(s) adresleri: yerel ve özel ağ adresleri reddedilir.
export function badUrl(u) {
  let url;
  try {
    url = new URL(u);
  } catch {
    return 'geçerli bir adres değil';
  }
  if (url.protocol !== 'https:' && url.protocol !== 'http:') return 'http ya da https ile başlamalı';
  const h = url.hostname.toLowerCase();
  if (h === 'localhost' || h.endsWith('.local') || h.endsWith('.internal') || h.includes(':')) return 'yerel adresler kontrol edilemez';
  if (/^(127\.|10\.|192\.168\.|169\.254\.|0\.|172\.(1[6-9]|2\d|3[01])\.)/.test(h)) return 'özel ağ adresleri kontrol edilemez';
  return '';
}

export async function check(c) {
  const urls = parseUrls(c.httpUrls);
  for (const u of urls) {
    const why = badUrl(u);
    if (why) throw new Error(`${u}: ${why}`);
  }
  const findings = [];
  for (const u of urls) {
    let problem = '';
    const started = Date.now();
    try {
      const r = await fetch(u, { method: 'GET', redirect: 'follow', cache: 'no-store', signal: AbortSignal.timeout(TIMEOUT_MS), headers: { 'User-Agent': 'NightWatch-HealthCheck' } });
      if (r.status >= 400) problem = `HTTP ${r.status} döndü`;
    } catch (e) {
      problem = e && e.name === 'TimeoutError' ? `${TIMEOUT_MS / 1000} saniyede yanıt vermedi` : `Bağlanılamadı: ${(e && e.cause && e.cause.code) || (e && e.message) || 'bilinmeyen hata'}`;
    }
    if (problem) {
      const url = new URL(u);
      findings.push({
        externalId: `http:${u}`,
        title: `Servis yanıt vermiyor: ${url.host}${url.pathname === '/' ? '' : url.pathname}`,
        category: 'prod',
        area: url.host,
        priority: 'kritik',
        env: 'production',
        sourceUrl: u,
        errorMessage: `${problem} (${Date.now() - started} ms)`,
        nextAction: 'Servisin ayakta olduğunu ve günlüklerini kontrol et',
      });
    }
  }
  return { findings, exhaustive: true, repoCount: undefined, urlCount: urls.length };
}
