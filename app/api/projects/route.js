import { NextResponse } from 'next/server';
import { sql } from '@/lib/db';
import { guard, canSee, fail } from '@/lib/auth';
import { today } from '@/lib/util';

export const dynamic = 'force-dynamic';

export async function GET() {
  const g = await guard();
  if (g.error) return g.error;
  try {
    const t = today();
    const rows = await sql()`
      SELECT p.id, p.name, p.members,
        (SELECT count(*) FROM records r WHERE r.project_id = p.id AND r.status <> 'cozuldu')::int AS open,
        (SELECT count(*) FROM records r WHERE r.project_id = p.id AND r.status <> 'cozuldu' AND r.priority = 'kritik')::int AS critical,
        (SELECT count(*) FROM records r WHERE r.project_id = p.id AND r.status <> 'cozuldu' AND r.due_date <> '' AND r.due_date < ${t})::int AS late,
        (SELECT count(*) FROM reminders m WHERE m.project_id = p.id AND m.done = false AND m.due_date <> '' AND m.due_date <= ${t})::int AS reminders,
        (SELECT count(*) FROM checks c WHERE c.project_id = p.id AND c.ok = false)::int AS failing
      FROM projects p ORDER BY lower(p.name)`;
    const projects = rows.filter((p) => canSee(g.user, p)).map(({ members, ...p }) => p);
    return NextResponse.json({ user: { email: g.user.email, admin: g.user.admin }, projects });
  } catch (e) {
    return fail(e);
  }
}

export async function POST(req) {
  const g = await guard(undefined, { adminOnly: true });
  if (g.error) return g.error;
  const body = await req.json().catch(() => ({}));
  const name = String(body.name || '').trim().slice(0, 80);
  if (!name) return NextResponse.json({ error: 'Proje adı gerekli' }, { status: 400 });
  try {
    const rows = await sql()`INSERT INTO projects (name, notify_email, created_at)
                             VALUES (${name}, ${g.user.email}, ${new Date().toISOString()}) RETURNING id`;
    return NextResponse.json({ id: rows[0].id });
  } catch (e) {
    return fail(e);
  }
}
