import { NextResponse } from 'next/server';
import { sql, ensureSchema } from '@/lib/db';
import { runChecks, SERVICES, everyMinutes } from '@/lib/sync';
import { decrypt, configured } from '@/lib/creds';
import { sendAlert } from '@/lib/alert';

export const dynamic = 'force-dynamic';
export const maxDuration = 300;

// Sık kontrol: dışarıdaki bir zamanlayıcı bu adresi birkaç dakikada bir çağırır.
// Her projede, sıklığı ayarlanmış ve süresi dolmuş servisler yoklanır; yeni sorun çıkarsa anında mail gider.
// Yetki: "Authorization: Bearer <CRON_SECRET>" başlığı ya da ?key=<CRON_SECRET>.
export async function GET(req) {
  const secret = process.env.CRON_SECRET;
  const given = (req.headers.get('authorization') || '').replace(/^Bearer /, '') || req.nextUrl.searchParams.get('key') || '';
  if (!secret || given !== secret) return NextResponse.json({ error: 'Yetkisiz' }, { status: 401 });
  try {
    await ensureSchema();
    const q = sql();
    const projects = await q`SELECT * FROM projects ORDER BY name`;
    const checks = await q`SELECT project_id, service, ran_at FROM checks`;
    const now = Date.now();
    const out = [];
    for (const p of projects) {
      let creds;
      try {
        creds = decrypt(p.credentials_enc);
      } catch {
        continue;
      }
      const on = configured(creds);
      const due = SERVICES.filter((s) => {
        const every = everyMinutes(creds, s.key);
        if (!on[s.key] || !every) return false;
        const last = checks.find((c) => c.project_id === p.id && c.service === s.key);
        // 45 saniyelik pay: zamanlayıcı birkaç saniye erken gelirse tur atlanmasın.
        return !last || !last.ran_at || now - Date.parse(last.ran_at) >= every * 60000 - 45000;
      }).map((s) => s.key);
      if (!due.length) continue;
      const { created } = await runChecks(p, { only: due });
      const mailed = await sendAlert(p, created, req.nextUrl.origin);
      out.push({ project: p.name, ran: due, created: created.length, mailed });
    }
    return NextResponse.json({ ok: true, projects: out });
  } catch (e) {
    return NextResponse.json({ error: String((e && e.message) || e) }, { status: 500 });
  }
}
