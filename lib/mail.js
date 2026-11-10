import { sql, ensureSchema } from './db';
import { today, addDays, isMonday, esc } from './util';

export async function getNotifyEmail() {
  await ensureSchema();
  const rows = await sql()`SELECT value FROM settings WHERE key = 'notify_email'`;
  return (rows[0] && rows[0].value) || process.env.NOTIFY_EMAIL || '';
}

export async function sendMail({ to, subject, html }) {
  if (!process.env.RESEND_API_KEY) throw new Error('RESEND_API_KEY tanımlı değil');
  if (!to) throw new Error('Bildirim adresi tanımlı değil');
  const r = await fetch('https://api.resend.com/emails', {
    method: 'POST',
    headers: { Authorization: `Bearer ${process.env.RESEND_API_KEY}`, 'Content-Type': 'application/json' },
    body: JSON.stringify({ from: process.env.MAIL_FROM || 'Bikort Takip <onboarding@resend.dev>', to: [to], subject, html }),
  });
  if (!r.ok) throw new Error(`Resend ${r.status}: ${(await r.text()).slice(0, 200)}`);
}

function appUrl() {
  if (process.env.APP_URL) return process.env.APP_URL.replace(/\/$/, '');
  if (process.env.VERCEL_PROJECT_PRODUCTION_URL) return `https://${process.env.VERCEL_PROJECT_PRODUCTION_URL}`;
  return '';
}

function section(title, items, line) {
  if (!items.length) return '';
  return `<h3 style="margin:22px 0 8px;font-size:15px;color:#1a2249">${esc(title)} (${items.length})</h3><ul style="margin:0;padding-left:18px">${items
    .map((i) => `<li style="margin:4px 0">${line(i)}</li>`)
    .join('')}</ul>`;
}

const PR = { kritik: 'Kritik', yuksek: 'Yüksek', orta: 'Orta', dusuk: 'Düşük' };
function rec(r) {
  const link = r.source_url && /^https?:\/\//i.test(r.source_url) ? ` · <a href="${esc(r.source_url)}">kaynak</a>` : '';
  const extra = [PR[r.priority] || '', r.due_date ? `hedef ${r.due_date}` : '', r.next_action ? `sonraki: ${r.next_action}` : ''].filter(Boolean).join(' · ');
  return `<b>${esc(r.title)}</b>${extra ? `<br><span style="color:#5b6385">${esc(extra)}</span>` : ''}${link}`;
}

// created: bu çalıştırmada otomatik açılan kayıtlar. empty true ise gönderecek bir şey yoktur.
export async function buildDigest({ created = [] } = {}) {
  await ensureSchema();
  const q = sql();
  const t = today();
  const open = await q`SELECT * FROM records WHERE status <> 'cozuldu' ORDER BY due_date`;
  const reminders = await q`SELECT * FROM reminders WHERE done = false AND due_date <> '' AND due_date <= ${t} ORDER BY due_date`;
  const crit = open.filter((r) => r.priority === 'kritik');
  const late = open.filter((r) => r.due_date && r.due_date < t);
  const dueToday = open.filter((r) => r.due_date === t);

  let weekly = '';
  const monday = isMonday();
  if (monday) {
    const from = addDays(t, -7);
    const to = addDays(t, -1);
    const opened = await q`SELECT title FROM records WHERE created_at >= ${from} AND created_at <= ${to}`;
    const resolved = await q`SELECT title FROM records WHERE status = 'cozuldu' AND resolved_at >= ${from} AND resolved_at <= ${to}`;
    const decided = await q`SELECT title, note FROM decisions WHERE status <> 'bekliyor' AND decided_at >= ${from} AND decided_at <= ${to}`;
    const pending = await q`SELECT title FROM decisions WHERE status = 'bekliyor'`;
    weekly =
      `<h2 style="margin:28px 0 4px;font-size:17px;color:#1a2249">Geçen hafta (${from} – ${to})</h2>` +
      `<p style="margin:0;color:#5b6385">Açılan: ${opened.length} · Çözülen: ${resolved.length} · Şu an açık: ${open.length}</p>` +
      section('Çözülenler', resolved, (r) => esc(r.title)) +
      section('Verilen kararlar', decided, (d) => `<b>${esc(d.title)}</b>${d.note ? `<br><span style="color:#5b6385">${esc(d.note)}</span>` : ''}`) +
      section('Karar bekleyen maddeler', pending, (d) => esc(d.title));
  }

  const empty = !created.length && !reminders.length && !crit.length && !late.length && !dueToday.length && !monday;
  const url = appUrl();
  const html =
    `<div style="font-family:-apple-system,Segoe UI,Roboto,sans-serif;max-width:600px;margin:0 auto;color:#12172e;line-height:1.5">` +
    `<div style="background:#0a0f24;color:#eceefb;padding:16px 20px;border-radius:12px 12px 0 0"><b style="font-size:17px">Bikort <span style="color:#b9a4ff">Operasyon</span></b><br><span style="color:#9aa3ca;font-size:13px">${esc(t)} günlük özet</span></div>` +
    `<div style="border:1px solid #dcdff0;border-top:0;padding:6px 20px 20px;border-radius:0 0 12px 12px">` +
    section('Yeni tespit edilenler', created, rec) +
    section('Hatırlatmalar', reminders, (m) => `<b>${esc(m.title)}</b> <span style="color:#5b6385">(${esc(m.due_date)})</span>${m.note ? `<br><span style="color:#5b6385">${esc(m.note)}</span>` : ''}`) +
    section('Açık kritik kayıtlar', crit, rec) +
    section('Hedef tarihi geçenler', late, rec) +
    section('Bugün hedef tarihli', dueToday, rec) +
    weekly +
    (empty ? '<p>Bugün dikkat gerektiren bir kayıt yok.</p>' : '') +
    (url ? `<p style="margin-top:24px"><a href="${esc(url)}" style="background:#8f70ff;color:#0d0a26;text-decoration:none;font-weight:600;padding:9px 14px;border-radius:8px">Panoyu aç</a></p>` : '') +
    `</div></div>`;
  const subject = `Bikort özet ${t}: ${crit.length} kritik, ${late.length} geciken, ${reminders.length} hatırlatma${created.length ? `, ${created.length} yeni` : ''}`;
  return { subject, html, empty };
}
