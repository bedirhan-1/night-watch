import { NextResponse } from 'next/server';
import { COOKIE, sessionToken } from '@/lib/auth';

export async function POST(req) {
  const body = await req.json().catch(() => ({}));
  const expected = process.env.APP_PASSWORD || '';
  if (!expected) return NextResponse.json({ error: 'APP_PASSWORD tanımlı değil' }, { status: 500 });
  if (String(body.password || '') !== expected) {
    await new Promise((r) => setTimeout(r, 800));
    return NextResponse.json({ error: 'Şifre hatalı' }, { status: 401 });
  }
  const res = NextResponse.json({ ok: true });
  res.cookies.set(COOKIE, await sessionToken(), { httpOnly: true, secure: true, sameSite: 'lax', path: '/', maxAge: 60 * 60 * 24 * 30 });
  return res;
}
