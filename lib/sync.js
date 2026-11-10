import { sql, ensureSchema } from './db';
import { today } from './util';
import { check as vercel } from './checks/vercel';
import { check as github } from './checks/github';
import { check as apple } from './checks/apple';
import { check as aws } from './checks/aws';

export const SERVICES = [
  { key: 'vercel', label: 'Vercel derlemeleri', run: vercel, env: 'VERCEL_TOKEN', configured: () => !!process.env.VERCEL_TOKEN },
  { key: 'github', label: 'GitHub Actions', run: github, env: 'GITHUB_TOKEN, GITHUB_REPOS', configured: () => !!(process.env.GITHUB_TOKEN && process.env.GITHUB_REPOS) },
  { key: 'apple', label: 'App Store / TestFlight', run: apple, env: 'ASC_KEY_ID, ASC_ISSUER_ID, ASC_PRIVATE_KEY', configured: () => !!(process.env.ASC_KEY_ID && process.env.ASC_ISSUER_ID && process.env.ASC_PRIVATE_KEY) },
  { key: 'aws', label: 'AWS güvenlik', run: aws, env: 'BIKORT_AWS_ACCESS_KEY_ID, BIKORT_AWS_SECRET_ACCESS_KEY', configured: () => !!(process.env.BIKORT_AWS_ACCESS_KEY_ID && process.env.BIKORT_AWS_SECRET_ACCESS_KEY) },
];

async function apply(service, result) {
  const q = sql();
  const t = today();
  const now = new Date().toISOString();
  const owner = process.env.DEFAULT_OWNER || '';
  const created = [];
  for (const f of result.findings || []) {
    const rows = await q`
      INSERT INTO records (title, category, area, owner, status, priority, env, source_url, error_message, expected_fix, next_action, created_at, updated_at, due_date, source, external_id, group_key)
      VALUES (${f.title}, ${f.category || 'diger'}, ${f.area || ''}, ${owner}, ${f.status || 'acik'}, ${f.priority || 'orta'}, ${f.env || ''}, ${f.sourceUrl || ''}, ${f.errorMessage || ''}, ${f.expectedFix || ''}, ${f.nextAction || ''}, ${t}, ${now}, ${f.dueDate || ''}, ${service}, ${f.externalId}, ${f.groupKey || ''})
      ON CONFLICT (external_id) DO NOTHING
      RETURNING id, title, priority, source_url`;
    if (rows.length) created.push(rows[0]);
  }
  // Sorun ortadan kalktıysa otomatik açılmış kayıtları kapat. Elle açılan kayıtlara dokunulmaz.
  if (result.resolvedGroups && result.resolvedGroups.length) {
    await q`UPDATE records SET status = 'cozuldu', resolved_at = ${t}, updated_at = ${now}
            WHERE source = ${service} AND status <> 'cozuldu' AND group_key = ANY(${result.resolvedGroups}::text[])`;
  }
  if (result.exhaustive) {
    const ids = (result.findings || []).map((f) => f.externalId);
    await q`UPDATE records SET status = 'cozuldu', resolved_at = ${t}, updated_at = ${now}
            WHERE source = ${service} AND status <> 'cozuldu' AND NOT (external_id = ANY(${ids}::text[]))`;
  }
  return created;
}

export async function runChecks() {
  await ensureSchema();
  const q = sql();
  const created = [];
  const results = [];
  for (const s of SERVICES) {
    if (!s.configured()) {
      results.push({ key: s.key, configured: false });
      continue;
    }
    let ok = true;
    let message = '';
    try {
      const r = await s.run();
      const c = await apply(s.key, r);
      created.push(...c);
      message = `${(r.findings || []).length} açık bulgu, ${c.length} yeni kayıt`;
    } catch (e) {
      ok = false;
      message = String((e && e.message) || e).slice(0, 300);
    }
    const now = new Date().toISOString();
    await q`INSERT INTO checks (service, ok, message, ran_at) VALUES (${s.key}, ${ok}, ${message}, ${now})
            ON CONFLICT (service) DO UPDATE SET ok = EXCLUDED.ok, message = EXCLUDED.message, ran_at = EXCLUDED.ran_at`;
    results.push({ key: s.key, configured: true, ok, message });
  }
  return { created, results };
}
