import { NextResponse } from 'next/server';
import { guard, fail } from '@/lib/auth';
import { runChecks } from '@/lib/sync';
import { buildDigest, notifyEmail, sendMail } from '@/lib/mail';

export const dynamic = 'force-dynamic';
export const maxDuration = 60;

// Panodaki "Şimdi kontrol et" ve "Özet mailini şimdi gönder" düğmeleri.
export async function POST(req, { params }) {
  const { pid } = await params;
  const g = await guard(pid);
  if (g.error) return g.error;
  const body = await req.json().catch(() => ({}));
  try {
    const { created, results } = await runChecks(g.project);
    let mailedTo = '';
    if (body.mail) {
      const to = notifyEmail(g.project);
      const d = await buildDigest(g.project, { created, origin: req.nextUrl.origin });
      await sendMail({ to, subject: d.subject, html: d.html });
      mailedTo = to;
    }
    return NextResponse.json({ created: created.length, results, mailedTo });
  } catch (e) {
    return fail(e);
  }
}
