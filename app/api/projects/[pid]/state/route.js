import { NextResponse } from 'next/server';
import { sql } from '@/lib/db';
import { guard, fail, memberEmails, newToken } from '@/lib/auth';
import { everyMinutes } from '@/lib/sync';
import { toCamel } from '@/lib/util';
import { SERVICES } from '@/lib/sync';
import { decrypt, configured, publicView } from '@/lib/creds';
import { fixBase, getLinks, latestRuns, lastTest } from '@/lib/fix';
import { routinePrompt, runView } from '@/lib/fix-rules.mjs';

export const dynamic = 'force-dynamic';

export async function GET(req, { params }) {
  const { pid } = await params;
  const g = await guard(pid);
  if (g.error) return g.error;
  try {
    const q = sql();
    const [records, decisions, reminders, checks, logs, links, runs, test] = await Promise.all([
      q`SELECT * FROM records WHERE project_id = ${pid} ORDER BY updated_at DESC`,
      q`SELECT * FROM decisions WHERE project_id = ${pid} ORDER BY created_at DESC`,
      q`SELECT * FROM reminders WHERE project_id = ${pid} ORDER BY due_date`,
      q`SELECT * FROM checks WHERE project_id = ${pid}`,
      q`SELECT * FROM logs WHERE project_id = ${pid} ORDER BY logged_at DESC LIMIT 1000`,
      getLinks(pid),
      latestRuns(pid),
      lastTest(pid, g.user.email),
    ]);
    let creds = {};
    let credError = '';
    try {
      creds = decrypt(g.project.credentials_enc);
    } catch (e) {
      credError = String((e && e.message) || e);
    }
    const on = configured(creds);
    const services = SERVICES.map((s) => {
      const c = checks.find((x) => x.service === s.key);
      return { key: s.key, label: s.label, every: everyMinutes(creds, s.key), configured: on[s.key], ok: c ? c.ok : null, message: c ? c.message : credError, ranAt: c ? c.ran_at : '' };
    });
    const p = g.project;
    // Projedeki kişiler: sahip ve üyeler. Henüz giriş yapmamış üyeler yalnızca e-postalarıyla görünür.
    const emails = memberEmails(p);
    const known = await q`SELECT email, name, avatar FROM users WHERE email = ANY(${emails}::text[])`;
    // Hata gönderme anahtarı ilk açılışta üretilir; yalnızca proje sahibine gösterilir.
    let ingestKey = p.ingest_key;
    if (g.owner && !ingestKey) {
      ingestKey = newToken();
      await q`UPDATE projects SET ingest_key = ${ingestKey} WHERE id = ${pid}`;
    }
    const people = emails.map((email) => {
      const u = known.find((x) => x.email === email);
      return { email, name: (u && u.name) || '', avatar: (u && u.avatar) || '' };
    });
    // Claude ile düzeltme: her kayıtta en son çalışmanın durumu; kartta kullanıcının kendi bağlantısı. Anahtar hiç dönmez.
    const now = Date.now();
    const fixOf = (id) => {
      const r = runs.get(id);
      return r ? { state: runView(r, now), sessionUrl: r.session_url, prUrl: r.pr_url, summary: r.summary, error: r.error, userEmail: r.user_email, at: r.updated_at } : null;
    };
    const base = fixBase();
    const mine = links.find((l) => l.userEmail === g.user.email);
    const claude = {
      ready: !!base,
      host: base ? new URL(base).host : '',
      prompt: base ? routinePrompt(base) : '',
      linked: !!mine,
      fireUrl: mine ? mine.fireUrl : '',
      broken: mine ? mine.broken : '',
      lastTest: test ? { state: runView(test, now), at: test.updated_at, error: test.error } : null,
      fixMode: p.fix_mode || 'otomatik',
    };
    return NextResponse.json({
      records: records.map((r) => ({ ...toCamel(r), fix: fixOf(r.id) })),
      decisions: decisions.map(toCamel),
      reminders: reminders.map(toCamel),
      logs: logs.map(toCamel),
      meta: {
        admin: g.owner,
        user: g.user.email,
        me: { email: g.user.email, name: g.user.name, avatar: g.user.avatar },
        people,
        mailConfigured: !!process.env.RESEND_API_KEY,
        project: g.owner
          ? { id: p.id, name: p.name, notifyEmail: p.notify_email, defaultOwner: p.default_owner, members: p.members, owner: p.owner_email, alertMode: p.alert_mode || 'hepsi', fixMode: p.fix_mode || 'otomatik' }
          : { id: p.id, name: p.name, owner: p.owner_email },
        claude,
        credentials: g.owner ? publicView(creds) : null,
        ingestUrl: g.owner ? `${(process.env.APP_URL || req.nextUrl.origin).replace(/\/$/, '')}/api/ingest/${ingestKey}` : '',
        services,
      },
    });
  } catch (e) {
    return fail(e);
  }
}
