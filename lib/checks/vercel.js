import { getJson } from '../util';

const WEEK = 7 * 24 * 3600 * 1000;

// Her proje + hedef + dal için en son biten deploy'a bakar: ERROR ise kayıt açar, READY ise o grubun açık kayıtlarını kapatır.
export async function check() {
  const token = process.env.VERCEL_TOKEN;
  if (!token) return { configured: false };
  const team = process.env.VERCEL_TEAM_ID;
  const data = await getJson(
    'https://api.vercel.com/v6/deployments?limit=100' + (team ? `&teamId=${encodeURIComponent(team)}` : ''),
    { Authorization: `Bearer ${token}` },
  );
  const seen = new Set();
  const findings = [];
  const resolvedGroups = [];
  for (const d of data.deployments || []) {
    const state = d.state || d.readyState;
    if (state !== 'ERROR' && state !== 'READY') continue;
    const branch = (d.meta && d.meta.githubCommitRef) || '';
    const target = d.target || 'preview';
    const group = `vercel:${d.name}:${target}:${branch}`;
    if (seen.has(group)) continue;
    seen.add(group);
    if (state === 'READY') {
      resolvedGroups.push(group);
      continue;
    }
    if (Date.now() - (d.created || 0) > WEEK) continue;
    const msg = (d.meta && d.meta.githubCommitMessage) || '';
    findings.push({
      externalId: `vercel:${d.uid}`,
      groupKey: group,
      title: `Vercel derlemesi başarısız: ${d.name}${branch ? ` (${branch})` : ''}`,
      category: 'ci',
      area: d.name,
      priority: target === 'production' ? 'yuksek' : 'orta',
      env: target === 'production' ? 'production' : 'staging',
      sourceUrl: d.inspectorUrl || (d.url ? `https://${d.url}` : ''),
      errorMessage: msg ? `Son commit: ${msg.split('\n')[0]}` : '',
      nextAction: 'Derleme günlüğünü aç, hatayı düzelt ve yeniden deploy et',
    });
  }
  return { configured: true, findings, resolvedGroups };
}
