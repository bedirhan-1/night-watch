import { createHash, randomBytes } from 'node:crypto';
import { cookies } from 'next/headers';
import { NextResponse } from 'next/server';
import { sql, ensureSchema } from './db';

export const COOKIE = 'nw_session';
export const hash = (s) => createHash('sha256').update(s).digest('hex');
export const newToken = () => randomBytes(32).toString('base64url');

const list = (s) => String(s || '').toLowerCase().split(',').map((x) => x.trim()).filter(Boolean);

// Kayıt herkese açıktır: giriş bağlantısına ilk kez basan adres için hesap oluşur.
// Her kullanıcı yalnızca sahibi ya da üyesi olduğu projeleri görür.
export async function getUser() {
  const c = (await cookies()).get(COOKIE)?.value;
  if (!c) return null;
  await ensureSchema();
  const now = new Date().toISOString();
  const rows = await sql()`SELECT u.id, u.email, u.name, u.avatar FROM sessions s JOIN users u ON u.id = s.user_id
                           WHERE s.token_hash = ${hash(c)} AND s.expires_at > ${now}`;
  if (!rows.length) return null;
  return { id: rows[0].id, email: rows[0].email, name: rows[0].name || '', avatar: rows[0].avatar || '' };
}

export const isOwner = (user, project) => project.owner_email === user.email;
export const memberEmails = (project) => Array.from(new Set([project.owner_email, ...list(project.members)].filter(Boolean)));
export const canSee = (user, project) => isOwner(user, project) || list(project.members).includes(user.email);

const deny = (error, status) => ({ error: NextResponse.json({ error }, { status }) });

// Route handler'larda: const g = await guard(pid); if (g.error) return g.error;
// ownerOnly: ayarlar, servis bilgileri ve silme yalnızca proje sahibine açıktır.
export async function guard(pid, { ownerOnly = false } = {}) {
  try {
    const user = await getUser();
    if (!user) return deny('Oturum gerekli', 401);
    if (pid === undefined) return { user };
    const rows = await sql()`SELECT * FROM projects WHERE id = ${pid}`;
    if (!rows.length || !canSee(user, rows[0])) return deny('Proje bulunamadı', 404);
    if (ownerOnly && !isOwner(user, rows[0])) return deny('Bu işlemi yalnızca proje sahibi yapabilir', 403);
    return { user, project: rows[0], owner: isOwner(user, rows[0]) };
  } catch (e) {
    return deny(String((e && e.message) || e), 500);
  }
}

export const fail = (e) => NextResponse.json({ error: String((e && e.message) || e) }, { status: 500 });
