import { NextResponse } from 'next/server';
import { finishFix } from '@/lib/fix';

export const dynamic = 'force-dynamic';

// Claude görevi işini bitirince sonucu buraya bildirir: POST /api/fix/<çalışma id>
// Gövde: { token, status: "pr" | "cozulemedi" | "deneme", pr_url?, summary? }
// Oturum gerekmez; yetki, tetiklemede o çalışma için üretilen tek kullanımlık anahtardır.
export async function POST(req, { params }) {
  const { run } = await params;
  if (!/^[A-Za-z0-9-]{8,64}$/.test(run)) return NextResponse.json({ error: 'Çalışma bulunamadı' }, { status: 404 });
  const body = await req.json().catch(() => null);
  try {
    const r = await finishFix({ runId: run, token: body && body.token, body });
    if (r.code !== 200) return NextResponse.json({ error: r.error }, { status: r.code });
    return NextResponse.json({ ok: true });
  } catch (e) {
    console.error('[fix] sonuç alınamadı:', e && e.message);
    return NextResponse.json({ error: 'Sonuç alınamadı' }, { status: 500 });
  }
}
