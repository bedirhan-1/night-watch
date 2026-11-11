import { NextResponse } from 'next/server';
import { sql, TABLES } from '@/lib/db';
import { guard, fail } from '@/lib/auth';
import { pick } from '@/lib/crud';
import { toCamel } from '@/lib/util';
import { notifyAssignment } from '@/lib/notify';

export async function PUT(req, { params }) {
  const { pid, table, id } = await params;
  const g = await guard(pid);
  if (g.error) return g.error;
  const data = pick(table, await req.json().catch(() => ({})));
  if (!data) return NextResponse.json({ error: 'Bilinmeyen tablo' }, { status: 404 });
  if ('title' in data && !data.title) return NextResponse.json({ error: 'Başlık gerekli' }, { status: 400 });
  try {
    const watchOwner = table === 'records' && 'owner' in data;
    const before = watchOwner ? await sql()`SELECT owner FROM records WHERE id = ${id} AND project_id = ${pid}` : [];
    const keys = Object.keys(data);
    const n = keys.length;
    const text = `UPDATE ${table} SET ${keys.map((k, i) => `${k} = $${i + 1}`).join(', ')} WHERE id = $${n + 1} AND project_id = $${n + 2} RETURNING *`;
    const rows = await sql().query(text, [...keys.map((k) => data[k]), id, pid]);
    if (!rows.length) return NextResponse.json({ error: 'Kayıt bulunamadı' }, { status: 404 });
    if (watchOwner) await notifyAssignment({ project: g.project, record: rows[0], previousOwner: before.length ? before[0].owner : '', actor: g.user, origin: req.nextUrl.origin });
    return NextResponse.json(toCamel(rows[0]));
  } catch (e) {
    return fail(e);
  }
}

export async function DELETE(_req, { params }) {
  const { pid, table, id } = await params;
  const g = await guard(pid);
  if (g.error) return g.error;
  if (!TABLES[table]) return NextResponse.json({ error: 'Bilinmeyen tablo' }, { status: 404 });
  try {
    await sql().query(`DELETE FROM ${table} WHERE id = $1 AND project_id = $2`, [id, pid]);
    return NextResponse.json({ ok: true });
  } catch (e) {
    return fail(e);
  }
}
