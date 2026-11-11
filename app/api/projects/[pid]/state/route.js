import { NextResponse } from 'next/server';
import { sql } from '@/lib/db';
import { guard, fail, memberEmails } from '@/lib/auth';
import { toCamel } from '@/lib/util';
import { SERVICES } from '@/lib/sync';
import { decrypt, configured, publicView } from '@/lib/creds';

export const dynamic = 'force-dynamic';

export async function GET(_req, { params }) {
  const { pid } = await params;
  const g = await guard(pid);
  if (g.error) return g.error;
  try {
    const q = sql();
    const [records, decisions, reminders, checks, logs] = await Promise.all([
      q`SELECT * FROM records WHERE project_id = ${pid} ORDER BY updated_at DESC`,
      q`SELECT * FROM decisions WHERE project_id = ${pid} ORDER BY created_at DESC`,
      q`SELECT * FROM reminders WHERE project_id = ${pid} ORDER BY due_date`,
      q`SELECT * FROM checks WHERE project_id = ${pid}`,
      q`SELECT * FROM logs WHERE project_id = ${pid} ORDER BY logged_at DESC LIMIT 1000`,
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
      return { key: s.key, label: s.label, configured: on[s.key], ok: c ? c.ok : null, message: c ? c.message : credError, ranAt: c ? c.ran_at : '' };
    });
    const p = g.project;
    // Projedeki kişiler: sahip ve üyeler. Henüz giriş yapmamış üyeler yalnızca e-postalarıyla görünür.
    const emails = memberEmails(p);
    const known = await q`SELECT email, name, avatar FROM users WHERE email = ANY(${emails}::text[])`;
    const people = emails.map((email) => {
      const u = known.find((x) => x.email === email);
      return { email, name: (u && u.name) || '', avatar: (u && u.avatar) || '' };
    });
    return NextResponse.json({
      records: records.map(toCamel),
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
          ? { id: p.id, name: p.name, notifyEmail: p.notify_email, defaultOwner: p.default_owner, members: p.members, owner: p.owner_email }
          : { id: p.id, name: p.name, owner: p.owner_email },
        credentials: g.owner ? publicView(creds) : null,
        services,
      },
    });
  } catch (e) {
    return fail(e);
  }
}
