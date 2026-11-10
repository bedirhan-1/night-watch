import { sql, ensureSchema } from './db';
import { today } from './util';
import { decrypt, configured } from './creds';
import { check as vercel } from './checks/vercel';
import { check as github } from './checks/github';
import { check as apple } from './checks/apple';
import { check as aws } from './checks/aws';

export const SERVICES = [
  { key: 'vercel', label: 'Vercel derlemeleri', run: vercel },
  { key: 'github', label: 'GitHub Actions', run: github },
  { key: 'apple', label: 'App Store / TestFlight', run: apple },
  { key: 'aws', label: 'AWS güvenlik', run: aws },
];

async function apply(project, service, result) {
  const q = sql();
  const pid = project.id;
  const t = today();
  const now = new Date().toISOString();
  const owner = project.default_owner || '';
  const created = [];
  for (const f of result.findings || []) {
    const rows = await q`
      INSERT INTO records (project_id, title, category, area, owner, status, priority, env, source_url, error_message, expected_fix, next_action, created_at, updated_at, due_date, source, external_id, group_key)
      VALUES (${pid}, ${f.title}, ${f.category || 'diger'}, ${f.area || ''}, ${owner}, ${f.status || 'acik'}, ${f.priority || 'orta'}, ${f.env || ''}, ${f.sourceUrl || ''}, ${f.errorMessage || ''}, ${f.expectedFix || ''}, ${f.nextAction || ''}, ${t}, ${now}, ${f.dueDate || ''}, ${service}, ${f.externalId}, ${f.groupKey || ''})
      ON CONFLICT (project_id, external_id) DO NOTHING
      RETURNING id, title, priority, source_url, due_date, next_action`;
    if (rows.length) created.push(rows[0]);
  }
  // Sorun ortadan kalktıysa otomatik açılmış kayıtları kapat. Elle açılan kayıtlara dokunulmaz.
  if (result.resolvedGroups && result.resolvedGroups.length) {
    await q`UPDATE records SET status = 'cozuldu', resolved_at = ${t}, updated_at = ${now}
            WHERE project_id = ${pid} AND source = ${service} AND status <> 'cozuldu' AND group_key = ANY(${result.resolvedGroups}::text[])`;
  }
  if (result.exhaustive) {
    const ids = (result.findings || []).map((f) => f.externalId);
    await q`UPDATE records SET status = 'cozuldu', resolved_at = ${t}, updated_at = ${now}
            WHERE project_id = ${pid} AND source = ${service} AND status <> 'cozuldu' AND NOT (external_id = ANY(${ids}::text[]))`;
  }
  return created;
}

// Bir projenin bağlı servislerini yoklar; yeni açılan kayıtları ve servis sonuçlarını döndürür.
export async function runChecks(project) {
  await ensureSchema();
  const q = sql();
  const creds = decrypt(project.credentials_enc);
  const on = configured(creds);
  const created = [];
  const results = [];
  for (const s of SERVICES) {
    if (!on[s.key]) {
      results.push({ key: s.key, configured: false });
      continue;
    }
    let ok = true;
    let message = '';
    try {
      const r = await s.run(creds);
      const c = await apply(project, s.key, r);
      created.push(...c);
      message = `${r.repoCount != null ? r.repoCount + ' depo · ' : ''}${(r.findings || []).length} açık bulgu, ${c.length} yeni kayıt`;
    } catch (e) {
      ok = false;
      message = String((e && e.message) || e).slice(0, 300);
    }
    const now = new Date().toISOString();
    await q`INSERT INTO checks (project_id, service, ok, message, ran_at) VALUES (${project.id}, ${s.key}, ${ok}, ${message}, ${now})
            ON CONFLICT (project_id, service) DO UPDATE SET ok = EXCLUDED.ok, message = EXCLUDED.message, ran_at = EXCLUDED.ran_at`;
    results.push({ key: s.key, configured: true, ok, message });
  }
  return { created, results };
}
