import { NextResponse } from 'next/server';
import { sql, ensureSchema } from '@/lib/db';
import { hash, newToken, fail } from '@/lib/auth';
import { sendMail, loginMail, appUrl } from '@/lib/mail';

// Kayıt herkese açık olduğu için bu uç, başkasının adresine mail attırmak için kötüye kullanılabilir.
// Sınırlar: adres başına dakikada 1 ve saatte 5, tüm uygulama için günde DAILY_LOGIN_MAILS (varsayılan 80).
const PER_HOUR = 5;
const dailyCap = () => Number(process.env.DAILY_LOGIN_MAILS) || 80;

export async function POST(req) {
  const body = await req.json().catch(() => ({}));
  const email = String(body.email || '').trim().toLowerCase();
  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email) || email.length > 200) return NextResponse.json({ error: 'Geçerli bir e-posta adresi gir' }, { status: 400 });
  if (!process.env.RESEND_API_KEY) return NextResponse.json({ error: 'RESEND_API_KEY tanımlı değil; giriş bağlantısı gönderilemiyor' }, { status: 500 });
  try {
    await ensureSchema();
    const q = sql();
    const now = new Date();
    const since = (ms) => new Date(now.getTime() - ms).toISOString();
    const mine = await q`SELECT created_at FROM login_tokens WHERE email = ${email} AND created_at > ${since(3600000)}`;
    if (mine.some((r) => r.created_at > since(60000))) {
      return NextResponse.json({ error: 'Az önce bir bağlantı gönderildi. Gelen kutunu kontrol et ya da bir dakika sonra tekrar dene.' }, { status: 429 });
    }
    if (mine.length >= PER_HOUR) return NextResponse.json({ error: 'Bu adres için çok fazla istek yapıldı. Bir saat sonra tekrar dene.' }, { status: 429 });
    const all = await q`SELECT count(*)::int AS n FROM login_tokens WHERE created_at > ${since(86400000)}`;
    if (all[0].n >= dailyCap()) {
      console.warn('[auth] günlük giriş maili sınırı doldu');
      return NextResponse.json({ error: 'Bugünlük giriş bağlantısı sınırı doldu. Yarın tekrar dene.' }, { status: 429 });
    }
    const token = newToken();
    await q`INSERT INTO login_tokens (token_hash, email, created_at, expires_at)
            VALUES (${hash(token)}, ${email}, ${now.toISOString()}, ${new Date(now.getTime() + 15 * 60000).toISOString()})`;
    const link = `${appUrl(req.nextUrl.origin)}/login/verify?token=${token}`;
    await sendMail({ to: email, subject: 'Night Watch giriş bağlantısı', html: loginMail(link) });
    return NextResponse.json({ ok: true });
  } catch (e) {
    console.error('[auth] giriş bağlantısı gönderilemedi:', e && e.message);
    return fail(e);
  }
}
