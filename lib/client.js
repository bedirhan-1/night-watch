// Tarayıcı tarafı API yardımcısı. 401 gelirse giriş sayfasına yollar.
export async function api(method, path, body) {
  const r = await fetch(path, {
    method,
    headers: body ? { 'Content-Type': 'application/json' } : undefined,
    body: body ? JSON.stringify(body) : undefined,
    cache: 'no-store',
  });
  if (r.status === 401) {
    window.location.href = '/login';
    throw new Error('Oturum kapandı');
  }
  const j = await r.json().catch(() => null);
  if (!r.ok) throw new Error((j && j.error) || `Hata ${r.status}`);
  return j;
}
