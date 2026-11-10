import { NextResponse } from 'next/server';
import { sql } from '@/lib/db';
import { guard, fail } from '@/lib/auth';
import { decrypt, encrypt, ALL_KEYS, SERVICE_KEYS } from '@/lib/creds';

// { values: {...} } gönderilen alanları günceller; gönderilmeyen alanlar olduğu gibi kalır.
// { clear: "vercel" } o servisin tüm bilgilerini siler.
export async function PUT(req, { params }) {
  const { pid } = await params;
  const g = await guard(pid, { adminOnly: true });
  if (g.error) return g.error;
  const body = await req.json().catch(() => ({}));
  try {
    const creds = decrypt(g.project.credentials_enc);
    if (body.clear && SERVICE_KEYS[body.clear]) {
      for (const k of SERVICE_KEYS[body.clear]) delete creds[k];
      await sql()`DELETE FROM checks WHERE project_id = ${pid} AND service = ${body.clear}`;
    }
    for (const [k, v] of Object.entries(body.values || {})) {
      if (!ALL_KEYS.includes(k)) continue;
      const s = String(v == null ? '' : v).trim().slice(0, 8000);
      if (s) creds[k] = s;
      else delete creds[k];
    }
    await sql()`UPDATE projects SET credentials_enc = ${encrypt(creds)} WHERE id = ${pid}`;
    return NextResponse.json({ ok: true });
  } catch (e) {
    return fail(e);
  }
}
