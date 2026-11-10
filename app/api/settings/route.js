import { NextResponse } from 'next/server';
import { sql, ensureSchema } from '@/lib/db';

export async function POST(req) {
  const body = await req.json().catch(() => ({}));
  const email = String(body.notifyEmail || '').trim();
  if (email && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) return NextResponse.json({ error: 'Geçerli bir e-posta adresi gir' }, { status: 400 });
  try {
    await ensureSchema();
    await sql()`INSERT INTO settings (key, value) VALUES ('notify_email', ${email})
                ON CONFLICT (key) DO UPDATE SET value = EXCLUDED.value`;
    return NextResponse.json({ ok: true });
  } catch (e) {
    return NextResponse.json({ error: String((e && e.message) || e) }, { status: 500 });
  }
}
