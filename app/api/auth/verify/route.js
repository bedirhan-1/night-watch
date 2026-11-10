import { NextResponse } from 'next/server';
import { sql, ensureSchema } from '@/lib/db';
import { COOKIE, hash, newToken, fail } from '@/lib/auth';

const MONTH = 60 * 60 * 24 * 30;

export async function POST(req) {
  const body = await req.json().catch(() => ({}));
  const token = String(body.token || '');
  if (!token) return NextResponse.json({ error: 'Bağlantı eksik' }, { status: 400 });
  try {
    await ensureSchema();
    const q = sql();
    const now = new Date();
    const used = await q`UPDATE login_tokens SET used = true
                         WHERE token_hash = ${hash(token)} AND used = false AND expires_at > ${now.toISOString()}
                         RETURNING email`;
    if (!used.length) {
      return NextResponse.json({ error: 'Bağlantı geçersiz ya da süresi dolmuş. Yeni bir bağlantı iste.' }, { status: 401 });
    }
    const users = await q`INSERT INTO users (email, created_at) VALUES (${used[0].email}, ${now.toISOString()})
                          ON CONFLICT (email) DO UPDATE SET email = EXCLUDED.email
                          RETURNING id`;
    const session = newToken();
    await q`INSERT INTO sessions (token_hash, user_id, expires_at)
            VALUES (${hash(session)}, ${users[0].id}, ${new Date(now.getTime() + MONTH * 1000).toISOString()})`;
    await q`DELETE FROM login_tokens WHERE created_at < ${new Date(now.getTime() - 2 * 86400000).toISOString()}`;
    const res = NextResponse.json({ ok: true });
    res.cookies.set(COOKIE, session, { httpOnly: true, secure: true, sameSite: 'lax', path: '/', maxAge: MONTH });
    return res;
  } catch (e) {
    return fail(e);
  }
}
