import { getJson } from '../util';

const BAD = ['failure', 'timed_out', 'startup_failure'];

// Her deponun varsayılan dalında, her iş akışının en son biten çalışmasına bakar.
export async function check() {
  const token = process.env.GITHUB_TOKEN;
  const repos = (process.env.GITHUB_REPOS || '').split(',').map((s) => s.trim()).filter(Boolean);
  if (!token || !repos.length) return { configured: false };
  const headers = { Authorization: `Bearer ${token}`, Accept: 'application/vnd.github+json', 'X-GitHub-Api-Version': '2022-11-28' };
  const findings = [];
  const resolvedGroups = [];
  for (const repo of repos) {
    const info = await getJson(`https://api.github.com/repos/${repo}`, headers);
    const branch = info.default_branch;
    const data = await getJson(
      `https://api.github.com/repos/${repo}/actions/runs?branch=${encodeURIComponent(branch)}&status=completed&per_page=50`,
      headers,
    );
    const seen = new Set();
    for (const run of data.workflow_runs || []) {
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
  return { configured: true, findings, resolvedGroups };
}
