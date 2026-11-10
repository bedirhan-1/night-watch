const BAD = ['failure', 'timed_out', 'startup_failure'];
const MAX_REPOS = 40;

async function gh(path, headers) {
  const r = await fetch(`https://api.github.com${path}`, { headers, cache: 'no-store' });
  return { status: r.status, ok: r.ok, data: await r.json().catch(() => null) };
}

// "sahip/*" yazıldıysa o sahibin token'ın görebildiği depolarını açar (arşivlenmişler hariç).
async function expand(entry, headers) {
  if (!entry.endsWith('/*')) return [entry];
  const owner = entry.slice(0, -2);
  let r = await gh(`/orgs/${owner}/repos?per_page=100&sort=pushed`, headers);
  if (r.status === 404) r = await gh(`/users/${owner}/repos?per_page=100&sort=pushed`, headers);
  if (!r.ok) throw new Error(`${owner} için depo listesi alınamadı (GitHub ${r.status}). Sahip adını ve token'ın "Resource owner" seçimini kontrol et.`);
  return (r.data || []).filter((x) => !x.archived && !x.disabled).map((x) => x.full_name);
}

// Her deponun varsayılan dalında, her iş akışının en son biten çalışmasına bakar.
export async function check(c) {
  const token = c.githubToken;
  const entries = (c.githubRepos || '').split(',').map((s) => s.trim()).filter(Boolean);
  const headers = { Authorization: `Bearer ${token}`, Accept: 'application/vnd.github+json', 'X-GitHub-Api-Version': '2022-11-28' };
  const bad = entries.find((e) => !/^[\w.-]+\/([\w.-]+|\*)$/.test(e));
  if (bad) throw new Error(`"${bad}" geçerli değil. Depoları sahip/depo biçiminde yaz (örn. bikort/web) ya da bir sahibin tüm depoları için sahip/* kullan.`);

  let repos = [];
  for (const e of entries) repos.push(...(await expand(e, headers)));
  repos = Array.from(new Set(repos)).slice(0, MAX_REPOS);

  const findings = [];
  const resolvedGroups = [];
  for (const repo of repos) {
    const info = await gh(`/repos/${repo}`, headers);
    if (info.status === 404) {
      throw new Error(`${repo} bulunamadı. Depo adı yanlış olabilir ya da token bu depoya erişemiyor: token'ı oluştururken "Resource owner" olarak ${repo.split('/')[0]} seçilmeli ve depo "Repository access" altında işaretlenmeli.`);
    }
    if (!info.ok) throw new Error(`${repo}: GitHub ${info.status} ${(info.data && info.data.message) || ''}`.trim());
    const branch = info.data.default_branch;
    const runs = await gh(`/repos/${repo}/actions/runs?branch=${encodeURIComponent(branch)}&status=completed&per_page=50`, headers);
    if (runs.status === 403 || runs.status === 404) {
      throw new Error(`${repo}: iş akışı çalışmaları okunamadı (GitHub ${runs.status}). Token'da "Actions: Read-only" izni olmalı.`);
    }
    if (!runs.ok) throw new Error(`${repo}: GitHub ${runs.status} ${(runs.data && runs.data.message) || ''}`.trim());
    const seen = new Set();
    for (const run of runs.data.workflow_runs || []) {
      const group = `github:${repo}:${run.workflow_id}:${branch}`;
      if (seen.has(group)) continue;
      seen.add(group);
      if (run.conclusion === 'success') {
        resolvedGroups.push(group);
      } else if (BAD.includes(run.conclusion)) {
        findings.push({
          externalId: `github:${run.id}`,
          groupKey: group,
          title: `CI başarısız: ${repo} · ${run.name} (${branch})`,
          category: 'ci',
          area: repo.split('/')[1] || repo,
          priority: 'yuksek',
          env: '',
          sourceUrl: run.html_url,
          errorMessage: `${run.conclusion}: ${run.display_title || ''}`,
          nextAction: 'Başarısız adımın günlüğünü incele',
        });
      }
    }
  }
  return { findings, resolvedGroups, repoCount: repos.length };
}
