import { NextResponse } from 'next/server';
import { sql, ensureSchema, TABLES } from '@/lib/db';
import { pick } from '@/lib/crud';
import { toCamel } from '@/lib/util';

export async function PUT(req, { params }) {
  const { table, id } = await params;
  const data = pick(table, await req.json().catch(() => ({})));
  if (!data) return NextResponse.json({ error: 'Bilinmeyen tablo' }, { status: 404 });
  if ('title' in data && !data.title) return NextResponse.json({ error: 'Başlık gerekli' }, { status: 400 });
  try {
    await ensureSchema();
    const keys = Object.keys(data);
    const text = `UPDATE ${table} SET ${keys.map((k, i) => `${k} = $${i + 1}`).join(', ')} WHERE id = $${keys.length + 1} RETURNING *`;
    const rows = await sql().query(text, [...keys.map((k) => data[k]), id]);
    if (!rows.length) return NextResponse.json({ error: 'Kayıt bulunamadı' }, { status: 404 });
    return NextResponse.json(toCamel(rows[0]));
  } catch (e) {
    return NextResponse.json({ error: String((e && e.message) || e) }, { status: 500 });
  }
}

export async function DELETE(_req, { params }) {
  const { table, id } = await params;
  if (!TABLES[table]) return NextResponse.json({ error: 'Bilinmeyen tablo' }, { status: 404 });
  try {
    await ensureSchema();
    await sql().query(`DELETE FROM ${table} WHERE id = $1`, [id]);
    return NextResponse.json({ ok: true });
  } catch (e) {
    return NextResponse.json({ error: String((e && e.message) || e) }, { status: 500 });
  }
}
