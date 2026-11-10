import { NextResponse } from 'next/server';
import { sql, ensureSchema } from '@/lib/db';
import { toCamel } from '@/lib/util';
import { SERVICES } from '@/lib/sync';

export const dynamic = 'force-dynamic';

export async function GET() {
  try {
    await ensureSchema();
    const q = sql();
    const [records, decisions, reminders, settings, checks] = await Promise.all([
      q`SELECT * FROM records ORDER BY updated_at DESC`,
      q`SELECT * FROM decisions ORDER BY created_at DESC`,
      q`SELECT * FROM reminders ORDER BY due_date`,
      q`SELECT key, value FROM settings`,
      q`SELECT * FROM checks`,
    ]);
    const saved = settings.find((s) => s.key === 'notify_email');
    const services = SERVICES.map((s) => {
      const c = checks.find((x) => x.service === s.key);
      return { key: s.key, label: s.label, env: s.env, configured: s.configured(), ok: c ? c.ok : null, message: c ? c.message : '', ranAt: c ? c.ran_at : '' };
    });
    return NextResponse.json({
      records: records.map(toCamel),
      decisions: decisions.map(toCamel),
      reminders: reminders.map(toCamel),
      meta: { notifyEmail: (saved && saved.value) || process.env.NOTIFY_EMAIL || '', mailConfigured: !!process.env.RESEND_API_KEY, services },
    });
  } catch (e) {
    return NextResponse.json({ error: String((e && e.message) || e) }, { status: 500 });
  }
}
