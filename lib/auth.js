import { createHash, randomBytes } from 'node:crypto';
import { cookies } from 'next/headers';
import { NextResponse } from 'next/server';
import { sql, ensureSchema } from './db';

export const COOKIE = 'nw_session';
export const hash = (s) => createHash('sha256').update(s).digest('hex');
export const newToken = () => randomBytes(32).toString('base64url');

const list = (s) => String(s || '').toLowerCase().split(',').map((x) => x.trim()).filter(Boolean);

export function admins() {
  return list(process.env.ADMIN_EMAILS);
}

// Giriş bağlantısı yalnızca yöneticilere ve bir projeye üye olarak eklenmiş adreslere gönderilir.
export async function isAllowed(email) {
  if (admins().includes(email)) return true;
  await ensureSchema();
  const rows = await sql()`SELECT members FROM projects`;
  return rows.some((r) => list(r.members).includes(email));
}

export async function getUser() {
  const c = (await cookies()).get(COOKIE)?.value;
  if (!c) return null;
  await ensureSchema();
  const now = new Date().toISOString();
  const rows = await sql()`SELECT u.id, u.email FROM sessions s JOIN users u ON u.id = s.user_id
                           WHERE s.token_hash = ${hash(c)} AND s.expires_at > ${now}`;
  if (!rows.length) return null;
  return { id: rows[0].id, email: rows[0].email, admin: admins().includes(rows[0].email) };
}

export function canSee(user, project) {
  return user.admin || list(project.members).includes(user.email);
}

const deny = (error, status) => ({ error: NextResponse.json({ error }, { status }) });

// Route handler'larda: const g = await guard(pid); if (g.error) return g.error;
export async function guard(pid, { adminOnly = false } = {}) {
  try {
    const user = await getUser();
    if (!user) return deny('Oturum gerekli', 401);
    if (pid === undefined) {
      if (adminOnly && !user.admin) return deny('Bu işlem için yönetici olmalısın', 403);
      return { user };
    }
    const rows = await sql()`SELECT * FROM projects WHERE id = ${pid}`;
    if (!rows.length || !canSee(user, rows[0])) return deny('Proje bulunamadı', 404);
    if (adminOnly && !user.admin) return deny('Bu işlem için yönetici olmalısın', 403);
    return { user, project: rows[0] };
  } catch (e) {
    return deny(String((e && e.message) || e), 500);
  }
}

export const fail = (e) => NextResponse.json({ error: String((e && e.message) || e) }, { status: 500 });
