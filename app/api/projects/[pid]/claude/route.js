import { NextResponse } from 'next/server';
import { guard, fail } from '@/lib/auth';
import { saveLink, deleteLink, startFix, reasonText } from '@/lib/fix';

export const dynamic = 'force-dynamic';

// Üyenin bu projedeki kendi Claude bağlantısı. Herkes yalnızca kendi bağlantısını yönetir.

// { fireUrl, token }: bağlantıyı kaydeder. token boşsa kayıtlı anahtar korunur.
export async function PUT(req, { params }) {
  const { pid } = await params;
  const g = await guard(pid);
  if (g.error) return g.error;
  const body = await req.json().catch(() => ({}));
  try {
    await saveLink({ projectId: pid, userEmail: g.user.email, fireUrl: body.fireUrl, token: body.token });
    return NextResponse.json({ ok: true });
  } catch (e) {
    return NextResponse.json({ error: String((e && e.message) || e) }, { status: 400 });
  }
}

export async function DELETE(_req, { params }) {
  const { pid } = await params;
  const g = await guard(pid);
  if (g.error) return g.error;
  try {
    await deleteLink({ projectId: pid, userEmail: g.user.email });
    return NextResponse.json({ ok: true });
  } catch (e) {
    return fail(e);
  }
}

// Deneme gönder: gerçek kayıt olmadan görevi tetikler; Claude yalnızca sonuç adresine "çalışıyor" bildirir.
// Adres, anahtar ve bulut ortamının ağ izni birlikte sınanır.
export async function POST(_req, { params }) {
  const { pid } = await params;
  const g = await guard(pid);
  if (g.error) return g.error;
  const r = await startFix({ project: g.project, trigger: 'deneme', actorEmail: g.user.email });
  if (!r.started) return NextResponse.json({ error: reasonText(r) }, { status: 400 });
  return NextResponse.json({ ok: true, sessionUrl: r.run.sessionUrl });
}
