import { NextResponse } from 'next/server';
import { cookies } from 'next/headers';
import { sql } from '@/lib/db';
import { COOKIE, hash } from '@/lib/auth';

export async function POST() {
  const c = (await cookies()).get(COOKIE)?.value;
  if (c) {
    try {
      await sql()`DELETE FROM sessions WHERE token_hash = ${hash(c)}`;
    } catch {}
  }
  const res = NextResponse.json({ ok: true });
  res.cookies.set(COOKIE, '', { httpOnly: true, secure: true, sameSite: 'lax', path: '/', maxAge: 0 });
  return res;
}
