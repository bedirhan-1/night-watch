import { timingSafeEqual } from 'node:crypto';
import { sql, ensureSchema } from './db';
import { today } from './util';
import { encrypt, decrypt } from './creds';
import { hash, newToken, memberEmails } from './auth';
import { sendMail, notifyEmail, fixMail, brokenLinkMail } from './mail';
import { validFireUrl, eligible, pickTarget, fireText, fireRoutine, parseResult, ACTIVE_MS, DAILY_FIX_CAP } from './fix-rules.mjs';

// Claude ile otomatik düzeltme: veritabanı ve tetikleme. Kurallar lib/fix-rules.mjs içinde.

// Sonuç adresi ve talimat şablonu yalnızca APP_URL'den üretilir; isteğin geldiği adres (önizleme, takma ad) kullanılmaz.
export function fixBase() {
  const u = String(process.env.APP_URL || '').trim().replace(/\/$/, '');
  return /^https?:\/\//i.test(u) ? u : '';
}

// Projedeki bağlantılar. Anahtar dönmez.
export async function getLinks(projectId) {
  const rows = await sql()`SELECT user_email, fire_url, broken, updated_at FROM claude_links WHERE project_id = ${projectId}`;
  return rows.map((r) => ({ userEmail: r.user_email, fireUrl: r.fire_url, broken: r.broken, updatedAt: r.updated_at }));
}

// Anahtar boş bırakılırsa kayıtlı anahtar korunur (yalnızca adres değişir).
export async function saveLink({ projectId, userEmail, fireUrl, token }) {
  if (!fixBase()) throw new Error('APP_URL tanımlı değil; Claude bağlantısı için gerekli');
  const url = String(fireUrl || '').trim();
  const tok = String(token || '').trim();
  if (!validFireUrl(url)) throw new Error('Tetikleme adresi https://api.anthropic.com/v1/claude_code/routines/trig_.../fire biçiminde olmalı');
  if (tok.length > 500) throw new Error('Anahtar çok uzun');
  const q = sql();
  const now = new Date().toISOString();
  const existing = await q`SELECT token_enc FROM claude_links WHERE project_id = ${projectId} AND user_email = ${userEmail}`;
  if (!tok && !existing.length) throw new Error('Anahtar gerekli');
  const enc = tok ? encrypt({ token: tok }) : existing[0].token_enc;
  await q`INSERT INTO claude_links (project_id, user_email, fire_url, token_enc, broken, created_at, updated_at)
          VALUES (${projectId}, ${userEmail}, ${url}, ${enc}, '', ${now}, ${now})
          ON CONFLICT (project_id, user_email) DO UPDATE SET fire_url = EXCLUDED.fire_url, token_enc = EXCLUDED.token_enc, broken = '', updated_at = EXCLUDED.updated_at`;
}

export async function deleteLink({ projectId, userEmail }) {
  await sql()`DELETE FROM claude_links WHERE project_id = ${projectId} AND user_email = ${userEmail}`;
}

// Kayıt başına en son çalışma (denemeler hariç).
export async function latestRuns(projectId) {
  const rows = await sql()`SELECT DISTINCT ON (record_id) * FROM fix_runs
                           WHERE project_id = ${projectId} AND trigger <> 'deneme' ORDER BY record_id, created_at DESC`;
  return new Map(rows.map((r) => [r.record_id, r]));
}

// Kullanıcının bu projedeki son deneme gönderimi.
export async function lastTest(projectId, userEmail) {
  const rows = await sql()`SELECT * FROM fix_runs WHERE project_id = ${projectId} AND user_email = ${userEmail} AND trigger = 'deneme'
                           ORDER BY created_at DESC LIMIT 1`;
  return rows[0] || null;
}

// Kaydı (ya da deneme yükünü) ilgili kişinin Claude görevine gönderir.
// trigger: otomatik (hata gönderme yolu), elle (kayıttaki düğme), deneme (bağlantı sınaması; record yok).
// Hiçbir koşulda fırlatmaz: bu özelliğin hatası kayıt açmayı ya da uyarı mailini bozmamalı.
export async function startFix({ project, record = null, trigger, actorEmail = '' }) {
  try {
    const base = fixBase();
    if (!base) return { started: false, reason: 'app_url' };
    await ensureSchema();
    const q = sql();
    const pid = project.id;
    const rid = record ? record.id : '';

    const links = await q`SELECT user_email, fire_url, token_enc, broken FROM claude_links WHERE project_id = ${pid}`;
    const manual = trigger !== 'otomatik';
    const target = pickTarget({
      prefer: manual ? actorEmail : '',
      recordOwner: trigger === 'deneme' ? '' : (record && record.owner) || '',
      projectOwner: trigger === 'deneme' ? '' : project.owner_email,
      members: memberEmails(project),
      links: links.map((l) => ({ userEmail: l.user_email, broken: l.broken })),
    });
    if (!target) return { started: false, reason: 'baglanti_yok' };
    const link = links.find((l) => l.user_email === target);

    const t = today();
    const now = new Date().toISOString();
    const cutoff = new Date(Date.now() - ACTIVE_MS).toISOString();
    // fix_day/fix_count bellekteki proje satırında eski olabilir; güncelini oku.
    const fresh = await q`SELECT fix_mode, fix_day, fix_count FROM projects WHERE id = ${pid}`;
    if (!fresh.length) return { started: false, reason: 'hata' };
    let autoAttempts = 0;
    let hasActiveRun = false;
    if (rid) {
      const stats = await q`SELECT count(*) FILTER (WHERE trigger = 'otomatik')::int AS auto,
                                   count(*) FILTER (WHERE status = 'calisiyor' AND created_at > ${cutoff})::int AS active
                            FROM fix_runs WHERE project_id = ${pid} AND record_id = ${rid}`;
      autoAttempts = stats[0].auto;
      hasActiveRun = stats[0].active > 0;
    }
    const check = eligible({
      trigger,
      mode: fresh[0].fix_mode || 'otomatik',
      record,
      autoAttempts,
      hasActiveRun,
      usedToday: fresh[0].fix_day === t ? fresh[0].fix_count : 0,
    });
    if (!check.ok) return { started: false, reason: check.reason };

    // Günlük hakkı tek sorguda ayır: eşzamanlı iki istek sınırı aşamasın.
    const reserved = await q`UPDATE projects SET fix_day = ${t}, fix_count = CASE WHEN fix_day = ${t} THEN fix_count + 1 ELSE 1 END
                             WHERE id = ${pid} AND (fix_day <> ${t} OR fix_count < ${DAILY_FIX_CAP}) RETURNING fix_count`;
    if (!reserved.length) return { started: false, reason: 'gunluk_sinir' };

    // Aynı kayıt için eşzamanlı ikinci çalışma açılmasın.
    const token = newToken();
    const inserted = await q`INSERT INTO fix_runs (project_id, record_id, user_email, trigger, status, callback_hash, created_at, updated_at)
                             SELECT ${pid}::text, ${rid}::text, ${target}::text, ${trigger}::text, 'calisiyor', ${hash(token)}::text, ${now}::text, ${now}::text
                             WHERE ${rid}::text = '' OR NOT EXISTS (
                               SELECT 1 FROM fix_runs WHERE project_id = ${pid} AND record_id = ${rid} AND status = 'calisiyor' AND created_at > ${cutoff})
                             RETURNING id`;
    if (!inserted.length) return { started: false, reason: 'calisiyor' };
    const runId = inserted[0].id;

    let previousPrUrl = '';
    if (rid) {
      const prev = await q`SELECT pr_url FROM fix_runs WHERE project_id = ${pid} AND record_id = ${rid} AND pr_url <> '' ORDER BY created_at DESC LIMIT 1`;
      previousPrUrl = prev.length ? prev[0].pr_url : '';
    }
    const text = fireText({
      kind: trigger === 'deneme' ? 'deneme' : 'hata',
      projectName: project.name,
      record,
      recordUrl: record ? `${base}/p/${pid}` : '',
      previousPrUrl,
      callbackUrl: `${base}/api/fix/${runId}`,
      callbackToken: token,
    });

    let fired;
    try {
      fired = await fireRoutine({ fireUrl: link.fire_url, token: decrypt(link.token_enc).token, text });
    } catch (e) {
      fired = { ok: false, broken: false, error: String((e && e.message) || e).slice(0, 300) };
    }
    if (fired.ok) {
      await q`UPDATE fix_runs SET session_url = ${fired.sessionUrl}, updated_at = ${new Date().toISOString()} WHERE id = ${runId}`;
      return { started: true, reason: '', run: { id: runId, sessionUrl: fired.sessionUrl, userEmail: target } };
    }
    await q`UPDATE fix_runs SET status = 'tetiklenemedi', error = ${fired.error}, updated_at = ${new Date().toISOString()} WHERE id = ${runId}`;
    if (fired.broken) {
      await q`UPDATE claude_links SET broken = ${fired.error} WHERE project_id = ${pid} AND user_email = ${target}`;
      // Bozuk bağlantı bir daha seçilmez, bu yüzden bu mail bağlantı yenilenene kadar bir kez gider.
      try {
        await sendMail({ to: target, subject: `Night Watch · ${project.name}: Claude bağlantısı çalışmıyor`, html: brokenLinkMail({ project, error: fired.error, base }) });
      } catch (e) {
        console.error('[fix] bağlantı uyarısı gönderilemedi:', e && e.message);
      }
    }
    return { started: false, reason: 'tetiklenemedi', error: fired.error, broken: fired.broken, userEmail: target };
  } catch (e) {
    console.error('[fix] Claude başlatılamadı:', e && e.message);
    return { started: false, reason: 'hata' };
  }
}

const sameHash = (a, b) => {
  const x = Buffer.from(String(a));
  const y = Buffer.from(String(b));
  return x.length === y.length && timingSafeEqual(x, y);
};

// Claude'un bildirdiği sonucu çalışmaya yazar. Yetki, tetiklemede gönderilen tek kullanımlık anahtardır.
// Sonuç yalnızca bir kez yazılır; ikinci istek 409 alır ve ilk sonuç değişmez.
export async function finishFix({ runId, token, body }) {
  await ensureSchema();
  const q = sql();
  const runs = await q`SELECT * FROM fix_runs WHERE id = ${String(runId)}`;
  if (!runs.length) return { code: 404, error: 'Çalışma bulunamadı' };
  const run = runs[0];
  if (!token || !run.callback_hash || !sameHash(hash(String(token)), run.callback_hash)) return { code: 403, error: 'Anahtar geçersiz' };
  const parsed = parseResult(body);
  if (!parsed.ok) return { code: 400, error: parsed.error };
  if ((run.trigger === 'deneme') !== (parsed.status === 'deneme')) return { code: 400, error: 'status bu çalışma için geçerli değil' };
  const status = parsed.status === 'deneme' ? 'tamam' : parsed.status;
  const done = await q`UPDATE fix_runs SET status = ${status}, pr_url = ${parsed.prUrl}, summary = ${parsed.summary}, updated_at = ${new Date().toISOString()}
                       WHERE id = ${run.id} AND status = 'calisiyor' RETURNING *`;
  if (!done.length) return { code: 409, error: 'Bu çalışmanın sonucu zaten bildirildi' };

  // Sonuç maili. Hatası sonucu etkilemez; kayıt bu arada silinmiş olabilir.
  if (run.trigger !== 'deneme') {
    try {
      const projects = await q`SELECT * FROM projects WHERE id = ${run.project_id}`;
      const project = projects[0];
      if (project && (project.alert_mode || 'hepsi') !== 'kapali') {
        const records = await q`SELECT id, title FROM records WHERE id = ${run.record_id} AND project_id = ${run.project_id}`;
        const html = fixMail({ project, record: records[0] || null, run: done[0], base: fixBase() });
        const subject = `Night Watch · ${project.name}: ${status === 'pr' ? 'Claude PR açtı' : 'Claude çözemedi'}`;
        for (const to of new Set([notifyEmail(project), run.user_email].filter(Boolean))) {
          try {
            await sendMail({ to, subject, html });
          } catch (e) {
            console.error('[fix] sonuç maili gönderilemedi:', e && e.message);
          }
        }
      }
    } catch (e) {
      console.error('[fix] sonuç maili hazırlanamadı:', e && e.message);
    }
  }
  return { code: 200 };
}
