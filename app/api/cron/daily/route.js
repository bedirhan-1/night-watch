import { NextResponse } from 'next/server';
import { sql, ensureSchema } from '@/lib/db';
import { runChecks } from '@/lib/sync';
import { buildDigest, notifyEmail, sendMail } from '@/lib/mail';

export const dynamic = 'force-dynamic';
export const maxDuration = 300;

// Vercel Cron her sabah çağırır (vercel.json). Vercel, CRON_SECRET tanımlıysa Authorization başlığını kendisi ekler.
// Her proje sırayla yoklanır ve kendi bildirim adresine ayrı özet gider.
export async function GET(req) {
  const secret = process.env.CRON_SECRET;
  if (!secret || req.headers.get('authorization') !== `Bearer ${secret}`) {
    return NextResponse.json({ error: 'Yetkisiz' }, { status: 401 });
  }
  try {
    await ensureSchema();
    const projects = await sql()`SELECT * FROM projects ORDER BY name`;
    const out = [];
    for (const p of projects) {
      const item = { project: p.name, created: 0, mailed: false, error: '' };
      try {
        const { created } = await runChecks(p);
        item.created = created.length;
        const d = await buildDigest(p, { created });
        if (!d.empty) {
          await sendMail({ to: notifyEmail(p), subject: d.subject, html: d.html });
          item.mailed = true;
        }
      } catch (e) {
        item.error = String((e && e.message) || e);
      }
      out.push(item);
    }
    return NextResponse.json({ projects: out });
  } catch (e) {
    return NextResponse.json({ error: String((e && e.message) || e) }, { status: 500 });
  }
}
