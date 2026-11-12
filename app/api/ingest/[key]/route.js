import { NextResponse } from 'next/server';
import { createHash } from 'node:crypto';
import { sql, ensureSchema } from '@/lib/db';
import { today } from '@/lib/util';
import { sendAlert } from '@/lib/alert';

export const dynamic = 'force-dynamic';

const LEVELS = { critical: 'kritik', fatal: 'kritik', error: 'yuksek', warning: 'orta', warn: 'orta', info: 'dusuk' };
const ENVS = ['local', 'staging', 'production'];
const str = (v, n) => String(v == null ? '' : v).trim().slice(0, n);

// Kendi backend'inden hata bildirmek için: POST /api/ingest/<proje anahtarı>
// Gövde: { title, message?, level?, environment?, service?, url?, fingerprint? }
// Aynı fingerprint (yoksa başlık) tek kayıtta toplanır: açık kayıt varsa sayacı artar, çözülmüşse yeniden açılır.
export async function POST(req, { params }) {
  const { key } = await params;
  if (!/^[A-Za-z0-9_-]{20,80}$/.test(key)) return NextResponse.json({ error: 'Geçersiz anahtar' }, { status: 404 });
  const body = await req.json().catch(() => null);
  if (!body || typeof body !== 'object') return NextResponse.json({ error: 'Gövde JSON olmalı' }, { status: 400 });
  const title = str(body.title || body.message, 200);
  if (!title) return NextResponse.json({ error: 'title gerekli' }, { status: 400 });
  try {
    await ensureSchema();
    const q = sql();
    const projects = await q`SELECT * FROM projects WHERE ingest_key = ${key}`;
    if (!projects.length) return NextResponse.json({ error: 'Geçersiz anahtar' }, { status: 404 });
    const project = projects[0];

    const message = str(body.stack || (body.title ? body.message : ''), 6000);
    const priority = LEVELS[String(body.level || 'error').toLowerCase()] || 'yuksek';
    const env = ENVS.includes(String(body.environment || body.env || '').toLowerCase()) ? String(body.environment || body.env).toLowerCase() : '';
    const area = str(body.service, 60);
    const url = /^https?:\/\//i.test(str(body.url, 500)) ? str(body.url, 500) : '';
    const fp = str(body.fingerprint, 200) || title;
    const ext = 'ingest:' + createHash('sha256').update(fp).digest('hex').slice(0, 32);
    const now = new Date().toISOString();

    const existing = await q`SELECT id, status FROM records WHERE project_id = ${project.id} AND external_id = ${ext}`;
    let status = 'new';
    let row;
    if (existing.length) {
      const reopen = existing[0].status === 'cozuldu';
      status = reopen ? 'reopened' : 'repeated';
      const rows = await q`UPDATE records SET occurrences = occurrences + 1, updated_at = ${now}, error_message = ${message},
                             status = CASE WHEN status = 'cozuldu' THEN 'acik' ELSE status END,
                             resolved_at = CASE WHEN status = 'cozuldu' THEN '' ELSE resolved_at END
                           WHERE id = ${existing[0].id} RETURNING *`;
      row = rows[0];
    } else {
      const rows = await q`
        INSERT INTO records (project_id, title, category, area, owner, status, priority, env, source_url, error_message, next_action, created_at, updated_at, source, external_id)
        VALUES (${project.id}, ${title}, 'prod', ${area}, ${project.default_owner || ''}, 'acik', ${priority}, ${env}, ${url}, ${message}, '', ${today()}, ${now}, 'backend', ${ext})
        ON CONFLICT (project_id, external_id) DO UPDATE SET occurrences = records.occurrences + 1, updated_at = EXCLUDED.updated_at
        RETURNING *`;
      row = rows[0];
    }
    if (status !== 'repeated') await sendAlert(project, [row], req.nextUrl.origin);
    return NextResponse.json({ ok: true, id: row.id, status, occurrences: row.occurrences });
  } catch (e) {
    console.error('[ingest]', e && e.message);
    return NextResponse.json({ error: 'Kayıt alınamadı' }, { status: 500 });
  }
}
