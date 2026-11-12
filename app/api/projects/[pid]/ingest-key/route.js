import { NextResponse } from 'next/server';
import { sql } from '@/lib/db';
import { guard, fail, newToken } from '@/lib/auth';

// Hata gönderme anahtarını yeniler; eski adres o andan itibaren çalışmaz.
export async function POST(_req, { params }) {
  const { pid } = await params;
  const g = await guard(pid, { ownerOnly: true });
  if (g.error) return g.error;
  try {
    await sql()`UPDATE projects SET ingest_key = ${newToken()} WHERE id = ${pid}`;
    return NextResponse.json({ ok: true });
  } catch (e) {
    return fail(e);
  }
}
