import { NextResponse } from 'next/server';
import { runChecks } from '@/lib/sync';
import { buildDigest, getNotifyEmail, sendMail } from '@/lib/mail';

export const dynamic = 'force-dynamic';
export const maxDuration = 60;

// Vercel Cron her sabah çağırır (vercel.json). Vercel, CRON_SECRET tanımlıysa Authorization başlığını kendisi ekler.
export async function GET(req) {
  const secret = process.env.CRON_SECRET;
  if (!secret || req.headers.get('authorization') !== `Bearer ${secret}`) {
    return NextResponse.json({ error: 'Yetkisiz' }, { status: 401 });
  }
  try {
    const { created, results } = await runChecks();
    const d = await buildDigest({ created });
    let mailed = false;
    let mailError = '';
    if (!d.empty) {
      try {
        await sendMail({ to: await getNotifyEmail(), subject: d.subject, html: d.html });
        mailed = true;
      } catch (e) {
        mailError = String((e && e.message) || e);
      }
    }
    return NextResponse.json({ created: created.length, results, mailed, mailError });
  } catch (e) {
    return NextResponse.json({ error: String((e && e.message) || e) }, { status: 500 });
  }
}
