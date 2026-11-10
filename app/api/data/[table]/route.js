import { NextResponse } from 'next/server';
import { sql, ensureSchema } from '@/lib/db';
import { pick } from '@/lib/crud';
import { toCamel } from '@/lib/util';

export async function POST(req, { params }) {
  const { table } = await params;
  const data = pick(table, await req.json().catch(() => ({})));
  if (!data) return NextResponse.json({ error: 'Bilinmeyen tablo' }, { status: 404 });
  if (!data.title) return NextResponse.json({ error: 'Başlık gerekli' }, { status: 400 });
  try {
    await ensureSchema();
    const keys = Object.keys(data);
    const text = `INSERT INTO ${table} (${keys.join(', ')}) VALUES (${keys.map((_, i) => '$' + (i + 1)).join(', ')}) RETURNING *`;
    const rows = await sql().query(text, keys.map((k) => data[k]));
    return NextResponse.json(toCamel(rows[0]));
  } catch (e) {
    return NextResponse.json({ error: String((e && e.message) || e) }, { status: 500 });
  }
}
