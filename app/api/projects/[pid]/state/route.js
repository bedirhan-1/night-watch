import { NextResponse } from 'next/server';
import { sql } from '@/lib/db';
import { guard, fail } from '@/lib/auth';
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
    const [records, decisions, reminders, checks] = await Promise.all([
      q`SELECT * FROM records WHERE project_id = ${pid} ORDER BY updated_at DESC`,
      q`SELECT * FROM decisions WHERE project_id = ${pid} ORDER BY created_at DESC`,
      q`SELECT * FROM reminders WHERE project_id = ${pid} ORDER BY due_date`,
      q`SELECT * FROM checks WHERE project_id = ${pid}`,
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
    return NextResponse.json({
      records: records.map(toCamel),
      decisions: decisions.map(toCamel),
      reminders: reminders.map(toCamel),
      meta: {
        admin: g.user.admin,
        mailConfigured: !!process.env.RESEND_API_KEY,
        project: g.user.admin
          ? { id: p.id, name: p.name, notifyEmail: p.notify_email, defaultOwner: p.default_owner, members: p.members }
          : { id: p.id, name: p.name },
        credentials: g.user.admin ? publicView(creds) : null,
        services,
      },
    });
  } catch (e) {
    return fail(e);
  }
}
