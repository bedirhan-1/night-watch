import { NextResponse } from 'next/server';
import { sql } from '@/lib/db';
import { guard, fail } from '@/lib/auth';
import { pick } from '@/lib/crud';
import { toCamel } from '@/lib/util';
import { notifyAssignment } from '@/lib/notify';

export async function POST(req, { params }) {
  const { pid, table } = await params;
  const g = await guard(pid);
  if (g.error) return g.error;
  const data = pick(table, await req.json().catch(() => ({})));
  if (!data) return NextResponse.json({ error: 'Bilinmeyen tablo' }, { status: 404 });
  if (!data.title) return NextResponse.json({ error: 'Başlık gerekli' }, { status: 400 });
  data.project_id = pid;
  try {
    const keys = Object.keys(data);
    const text = `INSERT INTO ${table} (${keys.join(', ')}) VALUES (${keys.map((_, i) => '$' + (i + 1)).join(', ')}) RETURNING *`;
    const rows = await sql().query(text, keys.map((k) => data[k]));
    if (table === 'records') await notifyAssignment({ project: g.project, record: rows[0], previousOwner: '', actor: g.user, origin: req.nextUrl.origin });
    return NextResponse.json(toCamel(rows[0]));
  } catch (e) {
    return fail(e);
  }
}
