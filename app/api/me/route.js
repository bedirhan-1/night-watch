import { NextResponse } from 'next/server';
import { sql } from '@/lib/db';
import { guard, fail } from '@/lib/auth';

export const dynamic = 'force-dynamic';

const MAX_AVATAR = 60000; // data URL uzunluğu; tarayıcı 96x96 JPEG'e küçültüp gönderir

export async function GET() {
  const g = await guard();
  if (g.error) return g.error;
  return NextResponse.json({ email: g.user.email, name: g.user.name, avatar: g.user.avatar });
}

// Görünen ad ve avatar. İkisi de isteğe bağlıdır; boş bırakılırsa e-postanın baş kısmı ve baş harfler gösterilir.
export async function PUT(req) {
  const g = await guard();
  if (g.error) return g.error;
  const body = await req.json().catch(() => ({}));
  const name = String(body.name || '').trim().slice(0, 40);
  const avatar = String(body.avatar || '');
  if (avatar && (!/^data:image\/(jpeg|png|webp);base64,[A-Za-z0-9+/=]+$/.test(avatar) || avatar.length > MAX_AVATAR)) {
    return NextResponse.json({ error: 'Avatar geçersiz ya da çok büyük' }, { status: 400 });
  }
  try {
    await sql()`UPDATE users SET name = ${name}, avatar = ${avatar} WHERE id = ${g.user.id}`;
    return NextResponse.json({ ok: true });
  } catch (e) {
    return fail(e);
  }
}
