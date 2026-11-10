import { NextResponse } from 'next/server';
import { sql } from '@/lib/db';
import { guard, fail } from '@/lib/auth';

const EMAIL = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

export async function PUT(req, { params }) {
  const { pid } = await params;
  const g = await guard(pid, { ownerOnly: true });
  if (g.error) return g.error;
  const body = await req.json().catch(() => ({}));
  const name = String(body.name || '').trim().slice(0, 80);
  const notify = String(body.notifyEmail || '').trim();
  const owner = String(body.defaultOwner || '').trim().slice(0, 80);
  const members = String(body.members || '').toLowerCase().split(',').map((s) => s.trim()).filter(Boolean);
  if (!name) return NextResponse.json({ error: 'Proje adı gerekli' }, { status: 400 });
  if (notify && !EMAIL.test(notify)) return NextResponse.json({ error: 'Bildirim adresi geçerli bir e-posta olmalı' }, { status: 400 });
  const bad = members.find((m) => !EMAIL.test(m));
  if (bad) return NextResponse.json({ error: `Geçersiz üye adresi: ${bad}` }, { status: 400 });
  try {
    await sql()`UPDATE projects SET name = ${name}, notify_email = ${notify}, default_owner = ${owner}, members = ${members.join(', ')} WHERE id = ${pid}`;
    return NextResponse.json({ ok: true });
  } catch (e) {
    return fail(e);
  }
}

export async function DELETE(_req, { params }) {
  const { pid } = await params;
  const g = await guard(pid, { ownerOnly: true });
  if (g.error) return g.error;
  try {
    const q = sql();
    await q`DELETE FROM records WHERE project_id = ${pid}`;
    await q`DELETE FROM decisions WHERE project_id = ${pid}`;
    await q`DELETE FROM reminders WHERE project_id = ${pid}`;
    await q`DELETE FROM checks WHERE project_id = ${pid}`;
    await q`DELETE FROM projects WHERE id = ${pid}`;
    return NextResponse.json({ ok: true });
  } catch (e) {
    return fail(e);
  }
}
