import { NextResponse } from 'next/server';
import { runChecks } from '@/lib/sync';
import { buildDigest, getNotifyEmail, sendMail } from '@/lib/mail';

export const dynamic = 'force-dynamic';
export const maxDuration = 60;

// Panodaki "Şimdi kontrol et" ve "Özet mailini şimdi gönder" düğmeleri.
export async function POST(req) {
  const body = await req.json().catch(() => ({}));
  try {
    const { created, results } = await runChecks();
    let mailedTo = '';
    if (body.mail) {
      const to = await getNotifyEmail();
      const d = await buildDigest({ created });
      await sendMail({ to, subject: d.subject, html: d.html });
      mailedTo = to;
    }
    return NextResponse.json({ created: created.length, results, mailedTo });
  } catch (e) {
    return NextResponse.json({ error: String((e && e.message) || e) }, { status: 500 });
  }
}
