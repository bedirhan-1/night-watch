import { NextResponse } from 'next/server';
import { sql } from '@/lib/db';
import { guard, fail } from '@/lib/auth';
import { startFix, reasonText } from '@/lib/fix';

export const dynamic = 'force-dynamic';

// "Claude'a düzelttir": kaydı elle Claude'a gönderir. Tetikleyen üyenin kendi bağlantısı varsa o kullanılır,
// yoksa kaydın sorumlusunun, o da yoksa proje sahibinin.
export async function POST(_req, { params }) {
  const { pid, id } = await params;
  const g = await guard(pid);
  if (g.error) return g.error;
  try {
    const rows = await sql()`SELECT * FROM records WHERE id = ${id} AND project_id = ${pid}`;
    if (!rows.length) return NextResponse.json({ error: 'Kayıt bulunamadı' }, { status: 404 });
    const r = await startFix({ project: g.project, record: rows[0], trigger: 'elle', actorEmail: g.user.email });
    if (!r.started) return NextResponse.json({ error: reasonText(r) }, { status: 400 });
    return NextResponse.json({ ok: true, sessionUrl: r.run.sessionUrl });
  } catch (e) {
    return fail(e);
  }
}
