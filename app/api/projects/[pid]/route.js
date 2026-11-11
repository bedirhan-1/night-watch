import { NextResponse } from 'next/server';
import { sql } from '@/lib/db';
import { guard, fail, memberEmails } from '@/lib/auth';
import { sendMail, inviteMail } from '@/lib/mail';

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
  if (members.length > 30) return NextResponse.json({ error: 'Bir projeye en fazla 30 üye eklenebilir' }, { status: 400 });
  try {
    await sql()`UPDATE projects SET name = ${name}, notify_email = ${notify}, default_owner = ${owner}, members = ${members.join(', ')} WHERE id = ${pid}`;
    // Listeye yeni eklenen adreslere davet maili gider; zaten üye olanlara tekrar gönderilmez.
    const already = memberEmails(g.project);
    const added = Array.from(new Set(members)).filter((m) => !already.includes(m));
    let invited = 0;
    const failed = [];
    for (const to of added) {
      try {
        await sendMail({
          to,
          subject: `Night Watch: ${name} projesine eklendin`,
          html: inviteMail({ projectName: name, inviter: g.user.name || g.user.email, origin: req.nextUrl.origin }),
        });
        invited += 1;
      } catch (e) {
        console.error('[invite] davet gönderilemedi:', e && e.message);
        failed.push(to);
      }
    }
    return NextResponse.json({ ok: true, invited, failed });
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
    await q`DELETE FROM logs WHERE project_id = ${pid}`;
    await q`DELETE FROM projects WHERE id = ${pid}`;
    return NextResponse.json({ ok: true });
  } catch (e) {
    return fail(e);
  }
}
