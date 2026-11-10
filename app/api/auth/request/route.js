import { NextResponse } from 'next/server';
import { sql, ensureSchema } from '@/lib/db';
import { isAllowed, hash, newToken, fail } from '@/lib/auth';
import { sendMail, loginMail, appUrl } from '@/lib/mail';

export async function POST(req) {
  const body = await req.json().catch(() => ({}));
  const email = String(body.email || '').trim().toLowerCase();
  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) return NextResponse.json({ error: 'Geçerli bir e-posta adresi gir' }, { status: 400 });
  if (!process.env.RESEND_API_KEY) return NextResponse.json({ error: 'RESEND_API_KEY tanımlı değil; giriş bağlantısı gönderilemiyor' }, { status: 500 });
  try {
    // Adres yetkili olsun olmasın aynı yanıt döner; böylece kimin erişimi olduğu dışarıdan anlaşılamaz.
    if (await isAllowed(email)) {
      await ensureSchema();
      const q = sql();
      const now = new Date();
      const recent = await q`SELECT 1 FROM login_tokens WHERE email = ${email} AND created_at > ${new Date(now.getTime() - 60000).toISOString()}`;
      if (!recent.length) {
        const token = newToken();
        await q`INSERT INTO login_tokens (token_hash, email, created_at, expires_at)
                VALUES (${hash(token)}, ${email}, ${now.toISOString()}, ${new Date(now.getTime() + 15 * 60000).toISOString()})`;
        const link = `${appUrl(req.nextUrl.origin)}/login/verify?token=${token}`;
        await sendMail({ to: email, subject: 'Night Watch giriş bağlantısı', html: loginMail(link) });
      }
    }
    return NextResponse.json({ ok: true });
  } catch (e) {
    return fail(e);
  }
}
