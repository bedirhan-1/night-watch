# Claude ile otomatik düzeltme: uygulama planı

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Backend hata kaydı açıldığı anda ilgili üyenin Claude Code bulut görevini tetiklemek, Claude'un açtığı PR'ı ve özeti kayda yazıp mail ile bildirmek.

**Architecture:** Kurallar ve metin üretimi saf işlevler olarak `lib/fix-rules.mjs` içinde durur ve `node --test` ile sınanır. Veritabanı, tetikleme ve mail `lib/fix.js` içindeki tek `startFix` işlevinde birleşir; `/api/ingest` (yanıttan sonra, `after()` ile) ve elle tetikleme aynı işlevi çağırır. Claude sonucu, tek kullanımlık anahtarla korunan `/api/fix/<çalışma id>` adresine bildirir.

**Tech Stack:** Next.js 15.5 (App Router, `after()`), Neon (`@neondatabase/serverless`), Resend, `node:test`, mevcut shadcn bileşenleri. Yeni bağımlılık yok.

**Spec:** `docs/superpowers/specs/2026-11-14-claude-otomatik-duzeltme-design.md`

## Global Constraints

- Tetikleme adresi yalnızca `^https://api\.anthropic\.com/v1/claude_code/routines/trig_[A-Za-z0-9]+/fire$` ile eşleşirse kabul edilir; başka adrese istek atılmaz.
- Tetikleme isteği: `POST`, başlıklar `Authorization: Bearer <anahtar>`, `anthropic-version: 2023-06-01`, `anthropic-beta: experimental-cc-routine-2026-04-01`, `Content-Type: application/json`; gövde `{ "text": "..." }`; zaman aşımı 8 saniye; otomatik yeniden deneme yok.
- `text` en fazla 65.536 karakter.
- Otomatik tetikleme yalnızca `source = 'backend'` ve öncelik `kritik` ya da `yuksek` olan kayıtlarda, kayıt ilk açıldığında ya da yeniden açıldığında.
- Kayıt başına en fazla 2 otomatik deneme; proje başına günde en fazla 10 tetikleme (otomatik, elle ve deneme toplam); sonuç bekleyen çalışma 2 saatten yeniyse ikincisi başlatılmaz.
- `APP_URL` zorunlu: sonuç adresi, şablondaki alan adı ve bu özelliğin maillerindeki bağlantılar yalnızca `APP_URL`'den üretilir; `req.nextUrl.origin` kullanılmaz. `APP_URL` yoksa bağlantı kaydedilmez ve tetikleme yapılmaz.
- Görev anahtarı `lib/creds.js` `encrypt` ile saklanır ve hiçbir yanıtta tarayıcıya dönmez.
- PR bağlantısı yalnızca `^https://github\.com/[\w.-]+/[\w.-]+/pull/\d+$` ile eşleşirse kabul edilir.
- Bu özelliğin hiçbir hatası kayıt açmayı ya da uyarı mailini bozmaz: `startFix` dışarı hata fırlatmaz.
- Arayüz ve mail metinleri Türkçe, mevcut üslupla; kod yorumları Türkçe.
- Her görev sonunda `npm test` ve `npm run build` geçer.

## Review Focus

1. **Aynı sonuç adresine ikinci istek ya da yanlış anahtar.** Beklenen: yanlış anahtar 403, sonucu yazılmış çalışma 409; ilk sonuç değişmez. Test: Görev 4.
2. **Çok uzun stack trace ya da başlık.** Beklenen: `text` 65.536 karakteri aşmaz, sonuç adresi ve anahtar kesilmez. Test: Görev 1.
3. **Sorumlunun bağlantısı bozuk ya da sorumlu artık üye değil.** Beklenen: sahibin bağlantısına düşülür; o da yoksa tetikleme yapılmaz, kayıt ve mail etkilenmez. Test: Görev 1.
4. **Anthropic yanıt vermiyor (zaman aşımı) ya da 429.** Beklenen: çalışma `tetiklenemedi` olur, neden yazılır, `/api/ingest` yine 200 döner. Test: Görev 1 (`fireRoutine`), elle doğrulama Görev 3.
5. **Çalışma sürerken kayıt silinmiş.** Beklenen: sonuç isteği 200 döner, çalışma güncellenir, mail gönderimi hata fırlatmaz. Test: Görev 4.

## Dosya yapısı

| Dosya | Sorumluluk |
| --- | --- |
| `lib/fix-rules.mjs` (yeni) | Saf işlevler: adres doğrulama, uygunluk, hedef seçimi, yük metni, talimat şablonu, çalışma görünümü, `fireRoutine` |
| `test/fix-rules.test.mjs` (yeni) | Yukarıdakilerin testleri |
| `lib/fix.js` (yeni) | `startFix`, `finishFix`, bağlantı okuma/yazma; veritabanı ve mail |
| `lib/db.js` | `claude_links`, `fix_runs` tabloları; `projects.fix_mode/fix_day/fix_count` |
| `lib/mail.js`, `lib/alert.js` | Uyarı mailinde oturum satırı; `fixMail`, `brokenLinkMail` |
| `app/api/ingest/[key]/route.js` | Yanıttan sonra tetikleme ve mail |
| `app/api/fix/[run]/route.js` (yeni) | Claude'dan sonuç |
| `app/api/projects/[pid]/claude/route.js` (yeni) | Bağlantı kaydet/sil, deneme gönder |
| `app/api/projects/[pid]/records/[id]/fix/route.js` (yeni) | Elle tetikleme |
| `app/api/projects/[pid]/route.js`, `state/route.js` | `fixMode`; bağlantı durumu ve çalışmalar |
| `middleware.js` | `/api/fix/` oturum denetiminden muaf |
| `components/board/panels.jsx`, `dialogs.jsx`, `issues.jsx` | Kart, ayar, kayıt bölümü, durum işareti |
| `docs/claude.md` (yeni), `README.md`, `docs/backend.md`, `.env.example` | Belgeler |

---

### Task 1: Saf kurallar ve test düzeni

**Files:**
- Create: `lib/fix-rules.mjs`, `test/fix-rules.test.mjs`
- Modify: `package.json` (`"test": "node --test test/"`), `.github/workflows/build.yml` (`npm run build` adımından önce `- run: npm test`)

**Interfaces:**
- Produces (hepsi `lib/fix-rules.mjs` adlandırılmış dışa aktarım):
  - `MAX_AUTO = 2`, `DAILY_FIX_CAP = 10`, `ACTIVE_MS = 2 * 60 * 60 * 1000`, `TEXT_MAX = 65536`
  - `validFireUrl(url: string): boolean`
  - `validPrUrl(url: string): boolean`
  - `eligible({ trigger: 'otomatik'|'elle'|'deneme', mode: 'otomatik'|'elle'|'kapali', record?: { source, priority }, autoAttempts: number, hasActiveRun: boolean, usedToday: number }): { ok: boolean, reason: '' | 'kapali' | 'elle' | 'kaynak' | 'oncelik' | 'deneme_siniri' | 'calisiyor' | 'gunluk_sinir' }`
  - `pickTarget({ prefer?: string, recordOwner: string, projectOwner: string, members: string[], links: { userEmail: string, broken: string }[] }): string | null` (seçilen `userEmail`)
  - `fireText({ kind: 'hata'|'deneme', projectName, record?: { title, priority, env, area, occurrences, source_url, error_message }, recordUrl?: string, previousPrUrl?: string, callbackUrl: string, callbackToken: string }): string`
  - `routinePrompt(appUrl: string): string`
  - `runView(run: { status, created_at } | null, now: number): 'yok' | 'calisiyor' | 'sonuc_yok' | 'pr' | 'cozulemedi' | 'tetiklenemedi' | 'tamam'`
  - `fireRoutine({ fireUrl, token, text, fetchFn = fetch, timeoutMs = 8000 }): Promise<{ ok: true, sessionUrl: string } | { ok: false, broken: boolean, error: string }>`

- [ ] **Step 1: Testleri yaz** (`test/fix-rules.test.mjs`, `node:test` ve `node:assert/strict`)

```js
test('validFireUrl', () => {
  assert.equal(validFireUrl('https://api.anthropic.com/v1/claude_code/routines/trig_01ABC/fire'), true);
  assert.equal(validFireUrl('https://api.anthropic.com.evil.com/v1/claude_code/routines/trig_01ABC/fire'), false);
  assert.equal(validFireUrl('http://api.anthropic.com/v1/claude_code/routines/trig_01ABC/fire'), false);
  assert.equal(validFireUrl('https://api.anthropic.com/v1/claude_code/routines/trig_01ABC/fire?x=1'), false);
});
test('validPrUrl', () => {
  assert.equal(validPrUrl('https://github.com/bikort/api/pull/42'), true);
  assert.equal(validPrUrl('https://github.com/bikort/api/pull/42/files'), false);
  assert.equal(validPrUrl('https://evil.com/github.com/a/b/pull/1'), false);
});
test('eligible: otomatik', () => {
  const base = { trigger: 'otomatik', mode: 'otomatik', record: { source: 'backend', priority: 'yuksek' }, autoAttempts: 0, hasActiveRun: false, usedToday: 0 };
  assert.deepEqual(eligible(base), { ok: true, reason: '' });
  assert.equal(eligible({ ...base, mode: 'kapali' }).reason, 'kapali');
  assert.equal(eligible({ ...base, mode: 'elle' }).reason, 'elle');
  assert.equal(eligible({ ...base, record: { source: 'github', priority: 'yuksek' } }).reason, 'kaynak');
  assert.equal(eligible({ ...base, record: { source: 'backend', priority: 'orta' } }).reason, 'oncelik');
  assert.equal(eligible({ ...base, autoAttempts: 2 }).reason, 'deneme_siniri');
  assert.equal(eligible({ ...base, hasActiveRun: true }).reason, 'calisiyor');
  assert.equal(eligible({ ...base, usedToday: 10 }).reason, 'gunluk_sinir');
});
test('eligible: elle her kaynakta, deneme sınırına takılmadan çalışır', () => {
  const r = eligible({ trigger: 'elle', mode: 'elle', record: { source: 'vercel', priority: 'dusuk' }, autoAttempts: 5, hasActiveRun: false, usedToday: 9 });
  assert.equal(r.ok, true);
  assert.equal(eligible({ trigger: 'elle', mode: 'kapali', autoAttempts: 0, hasActiveRun: false, usedToday: 0 }).reason, 'kapali');
  assert.equal(eligible({ trigger: 'elle', mode: 'otomatik', autoAttempts: 0, hasActiveRun: true, usedToday: 0 }).reason, 'calisiyor');
});
test('eligible: deneme yalnızca günlük sınıra bakar', () => {
  assert.equal(eligible({ trigger: 'deneme', mode: 'kapali', autoAttempts: 0, hasActiveRun: false, usedToday: 0 }).ok, true);
  assert.equal(eligible({ trigger: 'deneme', mode: 'otomatik', autoAttempts: 0, hasActiveRun: false, usedToday: 10 }).reason, 'gunluk_sinir');
});
test('pickTarget', () => {
  const members = ['sahip@x.com', 'uye@x.com'];
  const links = [{ userEmail: 'sahip@x.com', broken: '' }, { userEmail: 'uye@x.com', broken: '' }];
  const base = { recordOwner: 'uye@x.com', projectOwner: 'sahip@x.com', members, links };
  assert.equal(pickTarget(base), 'uye@x.com');
  assert.equal(pickTarget({ ...base, links: [links[0], { userEmail: 'uye@x.com', broken: '401' }] }), 'sahip@x.com');
  assert.equal(pickTarget({ ...base, members: ['sahip@x.com'] }), 'sahip@x.com'); // sorumlu artık üye değil
  assert.equal(pickTarget({ ...base, recordOwner: '', links: [links[1]] }), null); // sahip bağlı değil
  assert.equal(pickTarget({ ...base, recordOwner: '', prefer: 'uye@x.com' }), 'uye@x.com');
  assert.equal(pickTarget({ ...base, links: [] }), null);
});
test('fireText: sınırı aşmaz, sonuç adresi ve anahtar kesilmez', () => {
  const t = fireText({ kind: 'hata', projectName: 'P', record: { title: 'T'.repeat(500), priority: 'kritik', env: 'production', area: 'api', occurrences: 3, source_url: '', error_message: 'x'.repeat(200000) }, recordUrl: 'https://nw.example/p/1', previousPrUrl: 'https://github.com/a/b/pull/7', callbackUrl: 'https://nw.example/api/fix/r1', callbackToken: 'tok123' });
  assert.ok(t.length <= 65536);
  assert.ok(t.includes('https://nw.example/api/fix/r1'));
  assert.ok(t.includes('tok123'));
  assert.ok(t.includes('https://github.com/a/b/pull/7'));
});
test('fireText: deneme', () => {
  const t = fireText({ kind: 'deneme', projectName: 'P', callbackUrl: 'https://nw.example/api/fix/r1', callbackToken: 'tok' });
  assert.match(t, /^Tür: deneme/m);
});
test('routinePrompt alan adını içerir', () => {
  const p = routinePrompt('https://nw.example');
  assert.ok(p.includes('nw.example'));
  assert.ok(p.includes('routine-fire-payload'));
});
test('runView', () => {
  const now = Date.parse('2026-11-14T12:00:00Z');
  assert.equal(runView(null, now), 'yok');
  assert.equal(runView({ status: 'calisiyor', created_at: '2026-11-14T11:00:00Z' }, now), 'calisiyor');
  assert.equal(runView({ status: 'calisiyor', created_at: '2026-11-14T09:59:00Z' }, now), 'sonuc_yok');
  assert.equal(runView({ status: 'pr', created_at: '2026-11-01T00:00:00Z' }, now), 'pr');
});
test('fireRoutine', async () => {
  const ok = async (url, init) => {
    assert.equal(init.headers.Authorization, 'Bearer tok');
    assert.equal(init.headers['anthropic-beta'], 'experimental-cc-routine-2026-04-01');
    assert.deepEqual(JSON.parse(init.body), { text: 'merhaba' });
    return new Response(JSON.stringify({ type: 'routine_fire', claude_code_session_url: 'https://claude.ai/code/session_1' }), { status: 200 });
  };
  const U = 'https://api.anthropic.com/v1/claude_code/routines/trig_1/fire';
  assert.deepEqual(await fireRoutine({ fireUrl: U, token: 'tok', text: 'merhaba', fetchFn: ok }), { ok: true, sessionUrl: 'https://claude.ai/code/session_1' });
  const st = (s) => async () => new Response('{"type":"error","error":{"message":"m"}}', { status: s });
  assert.equal((await fireRoutine({ fireUrl: U, token: 't', text: '', fetchFn: st(401) })).broken, true);
  assert.equal((await fireRoutine({ fireUrl: U, token: 't', text: '', fetchFn: st(404) })).broken, true);
  assert.equal((await fireRoutine({ fireUrl: U, token: 't', text: '', fetchFn: st(429) })).broken, false);
  const hang = (_u, init) => new Promise((_, rej) => init.signal.addEventListener('abort', () => rej(new Error('aborted'))));
  const r = await fireRoutine({ fireUrl: U, token: 't', text: '', fetchFn: hang, timeoutMs: 20 });
  assert.equal(r.ok, false);
  assert.equal(r.broken, false);
  // Geçersiz adrese hiç istek atılmaz.
  let called = false;
  const r2 = await fireRoutine({ fireUrl: 'https://evil.com/fire', token: 't', text: '', fetchFn: async () => { called = true; } });
  assert.equal(called, false);
  assert.equal(r2.ok, false);
});
```

- [ ] **Step 2: Testlerin kırıldığını gör.** `npm test` → modül bulunamadı hatası.

- [ ] **Step 3: `lib/fix-rules.mjs` içinde işlevleri yaz.** Dosya hiçbir şeyi içe aktarmaz. İmzaların ve testlerin belirlemediği kararlar:
  - `eligible` denetim sırası: `deneme` → yalnızca `gunluk_sinir`. Diğerlerinde: `kapali`; (`otomatik` ise) `elle`, `kaynak`, `oncelik`, `deneme_siniri`; sonra `calisiyor`; sonra `gunluk_sinir`.
  - `pickTarget` aday sırası: `prefer`, `recordOwner`, `projectOwner`; aday `members` içinde olmalı ve `broken` boş bir bağlantısı bulunmalı.
  - `fireText` biçimi: satır başına `Etiket: değer` (`Tür`, `Proje`, `Başlık`, `Öncelik`, `Ortam`, `Servis`, `Kaç kez`, `Kaynak`, `Night Watch kaydı`, `Önceki deneme PR`, `Sonuç adresi`, `Sonuç anahtarı`), ardından `Hata mesajı:` ve gövde en sonda. Boş alanların satırı yazılmaz. Sınır aşılırsa yalnızca hata mesajı sondan kesilir; başlık 300 karakterle sınırlanır.
  - `routinePrompt` içeriği spec'in "Talimat şablonu" bölümündeki altı maddeyi kapsar; sonuç bildirimi için tam `curl` örneği ve gövde alanlarını (`token`, `status`: `pr` | `cozulemedi` | `deneme`, `pr_url`, `summary`) içerir; izinli tek alan adı olarak `new URL(appUrl).host` yazar.
  - `fireRoutine`: `validFireUrl` geçmezse istek atmadan `{ ok: false, broken: true, error }`. `AbortController` ile zaman aşımı. 401 ve 404 → `broken: true`. Yanıtta `claude_code_session_url` `https://claude.ai/` ile başlamıyorsa `sessionUrl: ''`. Hata metni 300 karakterle sınırlı.

- [ ] **Step 4: Testlerin geçtiğini gör.** `npm test` → tümü geçer.

- [ ] **Step 5: Commit.** `git add lib/fix-rules.mjs test package.json .github/workflows/build.yml && git commit -m "Claude ile düzeltme: kurallar, yük metni ve tetikleme istemcisi"`

---

### Task 2: Veri ve `startFix`

**Files:**
- Modify: `lib/db.js` (`ensureSchema` içine), `app/api/projects/[pid]/route.js` (`DELETE` içine iki tablo temizliği)
- Create: `lib/fix.js`

**Interfaces:**
- Consumes: Görev 1'in tüm dışa aktarımları; `encrypt`/`decrypt` (`lib/creds.js`), `hash`/`newToken`/`memberEmails` (`lib/auth.js`), `today` (`lib/util.js`).
- Produces (`lib/fix.js`):
  - `fixBase(): string` — `APP_URL` sonundaki `/` atılmış hali, tanımsızsa `''`.
  - `getLinks(projectId): Promise<{ userEmail, fireUrl, broken, updatedAt }[]>` (anahtar dönmez)
  - `saveLink({ projectId, userEmail, fireUrl, token }): Promise<void>` — `token` boşsa mevcut anahtar korunur; `broken` sıfırlanır. Geçersiz adres ya da `fixBase()` boşsa `Error` fırlatır (Türkçe mesaj).
  - `deleteLink({ projectId, userEmail }): Promise<void>`
  - `startFix({ project, record?, trigger, actorEmail? }): Promise<{ started: boolean, reason: string, run?: { id, sessionUrl, userEmail } }>` — hiçbir koşulda fırlatmaz; hata olursa `{ started: false, reason: 'hata' }` döner ve `console.error('[fix]', ...)` yazar.
  - `latestRuns(projectId): Promise<Map<recordId, run>>` — kayıt başına en son çalışma (`trigger <> 'deneme'`).

- [ ] **Step 1: Şemayı ekle.**

```sql
CREATE TABLE IF NOT EXISTS claude_links (
  project_id text NOT NULL, user_email text NOT NULL,
  fire_url text NOT NULL, token_enc text NOT NULL,
  broken text NOT NULL DEFAULT '',
  created_at text NOT NULL DEFAULT '', updated_at text NOT NULL DEFAULT '',
  PRIMARY KEY (project_id, user_email)
);
CREATE TABLE IF NOT EXISTS fix_runs (
  id text PRIMARY KEY DEFAULT gen_random_uuid()::text,
  project_id text NOT NULL, record_id text NOT NULL DEFAULT '',
  user_email text NOT NULL, trigger text NOT NULL,
  status text NOT NULL DEFAULT 'calisiyor',
  session_url text NOT NULL DEFAULT '', pr_url text NOT NULL DEFAULT '',
  summary text NOT NULL DEFAULT '', error text NOT NULL DEFAULT '',
  callback_hash text NOT NULL DEFAULT '',
  created_at text NOT NULL DEFAULT '', updated_at text NOT NULL DEFAULT ''
);
CREATE INDEX IF NOT EXISTS fix_runs_record_idx ON fix_runs (project_id, record_id);
ALTER TABLE projects ADD COLUMN IF NOT EXISTS fix_mode text NOT NULL DEFAULT 'otomatik';
ALTER TABLE projects ADD COLUMN IF NOT EXISTS fix_day text NOT NULL DEFAULT '';
ALTER TABLE projects ADD COLUMN IF NOT EXISTS fix_count integer NOT NULL DEFAULT 0;
```

`status` değerleri: `calisiyor`, `pr`, `cozulemedi`, `tetiklenemedi`, `tamam` (yalnızca başarılı deneme; spec'teki listeye ek).

- [ ] **Step 2: `lib/fix.js` yaz.** `startFix` adımları, bu sırayla:
  1. `fixBase()` boşsa → `reason: 'app_url'`.
  2. Bağlantıları oku; `pickTarget` (`prefer`: `trigger` `elle` ya da `deneme` ise `actorEmail`; `deneme`'de yalnızca `actorEmail` adaydır). Yoksa → `reason: 'baglanti_yok'`.
  3. `autoAttempts` (bu kayıt için `trigger = 'otomatik'` çalışma sayısı), `hasActiveRun` (bu kayıt için `status = 'calisiyor'` ve `created_at` son 2 saatte), `usedToday` (`fix_day = today()` ise `fix_count`, değilse 0) ile `eligible` çağır. `ok` değilse o `reason` ile dön.
  4. Günlük hakkı tek sorguda ayır; satır dönmezse → `gunluk_sinir`:
     ```sql
     UPDATE projects SET fix_day = $t, fix_count = CASE WHEN fix_day = $t THEN fix_count + 1 ELSE 1 END
     WHERE id = $pid AND (fix_day <> $t OR fix_count < 10) RETURNING fix_count
     ```
  5. `newToken()` ile sonuç anahtarı üret; `fix_runs` satırını `callback_hash = hash(token)` ile ekle. Kayıtlı çalışmalarda ekleme `INSERT ... SELECT ... WHERE NOT EXISTS (aynı kayıt için etkin çalışma)` ile yapılır; satır dönmezse → `calisiyor`.
  6. `previousPrUrl`: bu kaydın `pr_url` dolu en son çalışması. `fireText` ile metni üret (`callbackUrl = ${fixBase()}/api/fix/${run.id}`, `recordUrl = ${fixBase()}/p/${project.id}`), `fireRoutine` çağır.
  7. Başarılıysa `session_url` yaz, `{ started: true, reason: '', run }` dön. Başarısızsa `status = 'tetiklenemedi'`, `error` yaz; `broken` ise `claude_links.broken` alanını hata metniyle doldur ve bağlantı sahibine `brokenLinkMail` gönder (Görev 4 ekler; o göreve kadar yalnızca `console.warn`). `{ started: false, reason: 'tetiklenemedi' }` dön.

- [ ] **Step 3: Proje silmede temizlik.** `DELETE` içine `DELETE FROM claude_links WHERE project_id = ${pid}` ve `DELETE FROM fix_runs WHERE project_id = ${pid}`.

- [ ] **Step 4: Doğrula.** `npm test` ve `npm run build` geçer.

- [ ] **Step 5: Commit.** `git commit -m "Claude ile düzeltme: tablolar ve startFix"`

---

### Task 3: Ingest'e bağlama ve uyarı maili

**Files:**
- Modify: `app/api/ingest/[key]/route.js`, `lib/alert.js`, `lib/mail.js` (`alertMail`)

**Interfaces:**
- Consumes: `startFix` (Görev 2).
- Produces: `sendAlert(project, created, origin, { sessions } = {})` — `sessions`: `{ [recordId]: sessionUrl }`. `alertMail({ project, records, origin, last, sessions })`.

- [ ] **Step 1: `alertMail`'e oturum satırı ekle.** `sessions[r.id]` doluysa o kaydın altına: `Claude çalışmaya başladı` ve `Oturumu aç` bağlantısı. Bağlantı `esc` ile kaçışlanır. `sendAlert` dördüncü parametreyi `alertMail`'e iletir; verilmezse davranış bugünküyle aynıdır (`cron/tick` çağrısı değişmez).

- [ ] **Step 2: Ingest'te tetiklemeyi yanıttan sonraya al.** `next/server`'dan `after` içe aktar. `status !== 'repeated'` ise:

```js
after(async () => {
  const fix = await startFix({ project, record: row, trigger: 'otomatik' });
  const sessions = fix.started && fix.run.sessionUrl ? { [row.id]: fix.run.sessionUrl } : {};
  await sendAlert(project, [row], req.nextUrl.origin, { sessions });
});
```

Yanıt gövdesi ve durum kodları değişmez. `sendAlert` zaten kendi hatasını yutar; `startFix` fırlatmaz.

- [ ] **Step 3: Elle doğrula.** `npm run dev` ile, `APP_URL` tanımsızken:
  `curl -X POST localhost:3000/api/ingest/<anahtar> -H 'Content-Type: application/json' -d '{"title":"deneme hatası"}'` → `{"ok":true,...,"status":"new"}`, yanıt 1 saniyenin altında; sunucu günlüğünde `[fix]` hatası yok; `fix_runs` boş.

- [ ] **Step 4: `npm test`, `npm run build`, commit.** `git commit -m "Hata gönderme: yanıttan sonra Claude'u tetikle, mailde oturum bağlantısı"`

---

### Task 4: Sonuç adresi ve sonuç mailleri

**Files:**
- Create: `app/api/fix/[run]/route.js`
- Modify: `middleware.js` (muaf yollar listesine `pathname.startsWith('/api/fix/')`), `lib/mail.js` (`fixMail`, `brokenLinkMail`), `lib/fix.js` (`finishFix`, bozuk bağlantı maili), `lib/fix-rules.mjs` + test (`parseResult`)

**Interfaces:**
- Produces:
  - `parseResult(body): { ok: true, status: 'pr'|'cozulemedi'|'deneme', prUrl: string, summary: string } | { ok: false, error: string }` (`lib/fix-rules.mjs`)
  - `finishFix({ runId, token, body }): Promise<{ code: 200|400|403|404|409, error?: string }>` (`lib/fix.js`)
  - `fixMail({ project, record, run, base }): string`, `brokenLinkMail({ project, error, base }): string` (`lib/mail.js`)

- [ ] **Step 1: `parseResult` testlerini yaz.**

```js
test('parseResult', () => {
  assert.deepEqual(parseResult({ status: 'pr', pr_url: 'https://github.com/a/b/pull/3', summary: ' düzeltildi ' }), { ok: true, status: 'pr', prUrl: 'https://github.com/a/b/pull/3', summary: 'düzeltildi' });
  assert.equal(parseResult({ status: 'pr', pr_url: 'https://evil.com/x' }).ok, false);
  assert.equal(parseResult({ status: 'pr' }).ok, false);
  assert.equal(parseResult({ status: 'cozulemedi', summary: 'kodla ilgili değil' }).ok, true);
  assert.equal(parseResult({ status: 'deneme' }).ok, true);
  assert.equal(parseResult({ status: 'merge' }).ok, false);
  assert.equal(parseResult(null).ok, false);
  assert.equal(parseResult({ status: 'cozulemedi', summary: 'x'.repeat(9000) }).summary.length, 2000);
});
```

- [ ] **Step 2: Kırıldığını gör, `parseResult`'ı yaz, geçtiğini gör.** `npm test`.

- [ ] **Step 3: `finishFix` yaz.** Kurallar:
  - Çalışma yoksa 404. `hash(token) !== callback_hash` ise 403 (`timingSafeEqual` ile karşılaştır). `parseResult` geçmezse 400.
  - Sonuç tek sorguda ve yalnızca bir kez yazılır: `UPDATE fix_runs SET ... WHERE id = $id AND status = 'calisiyor' RETURNING *`; satır dönmezse 409. `deneme` → `status = 'tamam'`.
  - Çalışmanın `trigger`'ı `deneme` ise yalnızca `status: 'deneme'` kabul edilir; değilse `deneme` reddedilir (400).
  - Sonra, hata fırlatmadan: `trigger <> 'deneme'` ve `project.alert_mode !== 'kapali'` ise `fixMail` gönder. Alıcılar: `notifyEmail(project)` ve `run.user_email`, tekrarsız. Kayıt silinmişse başlık yerine "silinmiş kayıt" yazılır, mail yine gider.
  - Konu: `Night Watch · <proje>: Claude PR açtı` ya da `Night Watch · <proje>: Claude çözemedi`.

- [ ] **Step 4: `fixMail` ve `brokenLinkMail` yaz.** Mevcut `shell`/`button` yardımcılarıyla. `fixMail`: kayıt başlığı, özet (`esc`, `white-space:pre-wrap`), PR düğmesi (varsa), oturum bağlantısı, "Panoda aç". `brokenLinkMail`: bağlantının çalışmadığı, hata metni, Ayarlar'da yenilenmesi gerektiği. `startFix`'teki `console.warn` yerine bu mail gönderilir; bağlantı zaten `broken` ise ikinci mail gitmez (zaten `pickTarget` bozuk bağlantıyı seçmez).

- [ ] **Step 5: Route ve middleware.** `POST /api/fix/[run]`: gövdeyi JSON oku, `finishFix` çağır, `{ ok: true }` ya da `{ error }` dön. `export const dynamic = 'force-dynamic'`.

- [ ] **Step 6: Elle doğrula (Review Focus 1 ve 5).** Veritabanına elle bir `fix_runs` satırı ekle (`callback_hash` = bilinen bir anahtarın sha256'sı), sonra:
  - yanlış anahtar → 403; doğru anahtar + geçersiz `pr_url` → 400; doğru istek → 200; aynı istek yeniden → 409.
  - `record_id` var olmayan bir kimlikken doğru istek → 200, sunucu günlüğünde hata yok.
  - oturum çerezi olmadan istek 401 değil yukarıdaki kodları döner.

- [ ] **Step 7: `npm test`, `npm run build`, commit.** `git commit -m "Claude ile düzeltme: sonuç adresi ve sonuç mailleri"`

---

### Task 5: Uygulama içi API

**Files:**
- Create: `app/api/projects/[pid]/claude/route.js`, `app/api/projects/[pid]/records/[id]/fix/route.js`
- Modify: `app/api/projects/[pid]/route.js` (`PUT`: `fixMode`), `app/api/projects/[pid]/state/route.js`

**Interfaces:**
- Consumes: `saveLink`, `deleteLink`, `getLinks`, `startFix`, `latestRuns`, `fixBase` (Görev 2); `routinePrompt`, `runView` (Görev 1).
- Produces (HTTP; hepsi `guard(pid)` ile, üyeye açık, aksi yazılmadıkça):
  - `PUT /api/projects/:pid/claude` gövde `{ fireUrl, token }` → `{ ok: true }` ya da 400 `{ error }`. Yalnızca çağıranın kendi bağlantısı.
  - `DELETE /api/projects/:pid/claude` → `{ ok: true }`.
  - `POST /api/projects/:pid/claude` (deneme gönder) → `{ ok: true, sessionUrl }` ya da 400 `{ error }`.
  - `POST /api/projects/:pid/records/:id/fix` → `{ ok: true, sessionUrl }` ya da 400 `{ error }`.
  - `PUT /api/projects/:pid` gövdesinde `fixMode: 'otomatik'|'elle'|'kapali'` (yalnızca sahip; geçersizse mevcut değer korunur — `alertMode` ile aynı desen).
  - `GET .../state` eklemeleri:
    - her kayıtta `fix: { state, sessionUrl, prUrl, summary, error, userEmail, at } | null` (`state` = `runView` sonucu)
    - `meta.claude: { ready: boolean, host: string, prompt: string, linked: boolean, fireUrl: string, broken: string, lastTest: { state, at, error } | null, fixMode: string }` — `ready` = `fixBase()` dolu; `fireUrl`, `broken`, `lastTest` çağıranın kendi bağlantısına aittir; `prompt` = `routinePrompt(fixBase())`.
    - `meta.project.fixMode` (sahip görünümünde).

- [ ] **Step 1: Route'ları yaz.** `startFix`'in `reason` değerleri kullanıcıya şu metinlerle döner (400):

| reason | metin |
| --- | --- |
| `app_url` | `APP_URL tanımlı değil; Claude bağlantısı için gerekli` |
| `baglanti_yok` | `Bu projede bağlı bir Claude yok. Ayarlar'dan Claude'u bağla` |
| `kapali` | `Bu projede Claude ile düzeltme kapalı` |
| `calisiyor` | `Claude bu kayıt üzerinde zaten çalışıyor` |
| `gunluk_sinir` | `Bugünkü sınır doldu (günde 10)` |
| `tetiklenemedi` | `Claude başlatılamadı: <çalışmadaki hata>` |
| `hata` | `Claude başlatılamadı` |

Elle tetiklemede kayıt `project_id` ile birlikte aranır; yoksa 404.

- [ ] **Step 2: Elle doğrula.** Giriş yapmış oturumla: geçersiz adresle `PUT` → 400; `APP_URL` yokken `PUT` → 400 `app_url` metni; üye hesabıyla `GET state` yanıtında `meta.claude` var, `token` hiçbir yerde yok (`grep sk-ant` boş).

- [ ] **Step 3: `npm test`, `npm run build`, commit.** `git commit -m "Claude ile düzeltme: bağlantı, deneme ve elle tetikleme uçları"`

---

### Task 6: Arayüz

**Files:**
- Modify: `components/board/panels.jsx` (`ClaudeCard`, proje formunda "Otomatik düzeltme" seçimi), `components/board/dialogs.jsx` (`RecordForm` içinde "Claude" bölümü), `components/board/issues.jsx` (`Card` ve `IssueTable` satırında durum işareti), `app/p/[id]/page.js` (yeni işleyiciler; mevcut `onSaveCreds`/`onRegenIngest` deseniyle)

**Interfaces:**
- Consumes: Görev 5'in HTTP uçları ve `state` alanları; `api` (`lib/client.js`).

- [ ] **Step 1: `ClaudeCard`.** "Bağlı servisler" bölümünde, `IngestCard`'ın altında; `admin` koşulu olmadan herkese görünür. `IngestCard` düzenini izler (başlık, açıklama, "Nasıl bağlanır" aç/kapa). İçerik:
  - `meta.claude.ready` değilse yalnızca uyarı: `Bu özellik için sunucuda APP_URL tanımlı olmalı.`
  - Adımlar (numaralı): claude.ai/code/routines'te görev aç ve depoları seç; talimatı yapıştır (kopyala düğmeli `pre`, `meta.claude.prompt`); API tetikleyicisi ekle, adres ve anahtarı kopyala; bulut ortamının izinli alan adlarına `meta.claude.host` ekle (kopyala düğmeli); adres ve anahtarı aşağıya yapıştır.
  - Alanlar: "Tetikleme adresi" (`fireUrl`), "Anahtar" (`type="password"`, bağlıysa yer tutucu `Kayıtlı; değiştirmek için yenisini yaz`).
  - Düğmeler: `Kaydet`, `Deneme gönder`, bağlıysa `Bağlantıyı kaldır` (`Confirm`).
  - Durum satırı: bağlı / bozuk (`broken` metniyle, kırmızı) / son deneme (`Çalışıyor`, `Başarılı`, `Sonuç gelmedi: alan adı iznini kontrol et`, `Başlatılamadı: ...`).
- [ ] **Step 2: Proje formu.** "Anında mail" alanının altına `Pick`: `Claude ile düzeltme` — `Otomatik (yeni backend hatalarında)`, `Yalnızca elle`, `Kapalı`. Alt yazı: `Kayıt başına en fazla 2 otomatik deneme, günde en fazla 10.` `onSaveProject` gövdesine `fixMode` eklenir.
- [ ] **Step 3: Kayıt ayrıntısı.** `RecordForm`'da yalnızca var olan kayıtta (`item.id`) görünen "Claude" bölümü: durum metni, `Oturumu aç` ve `PR'ı aç` bağlantıları (`target="_blank" rel="noreferrer"`), özet ya da hata (düz metin, `whitespace-pre-wrap`), `Claude'a düzelttir` düğmesi (durum `calisiyor` iken kapalı). Düğme sonucu `toast` ile gösterilir ve durum yeniden yüklenir.
- [ ] **Step 4: Durum işareti.** `r.fix` varsa kartta ve tabloda küçük rozet: `calisiyor` → `Claude çalışıyor`, `pr` → `PR hazır` (bağlantı), `cozulemedi` → `Claude çözemedi`, `tetiklenemedi`/`sonuc_yok` → `Claude: sonuç yok`. Mevcut rozet bileşeni ve renkleri kullanılır.
- [ ] **Step 5: Tarayıcıda doğrula.** `npm run dev`; sahip ve üye hesabıyla: kart görünür, kaydetme/deneme/kaldırma çalışır, geçersiz adres hata `toast`'ı verir; veritabanına elle eklenen `pr` durumlu çalışma kartta rozet ve ayrıntıda PR bağlantısı olarak görünür; 375px genişlikte taşma yok.
- [ ] **Step 6: `npm test`, `npm run build`, commit.** `git commit -m "Claude ile düzeltme: bağlama kartı, kayıt bölümü ve durum işareti"`

---

### Task 7: Belgeler

**Files:**
- Create: `docs/claude.md`
- Modify: `README.md`, `docs/backend.md`, `.env.example`

- [ ] **Step 1: `docs/claude.md`.** Bölümler: ne yapar (akış, 7 adım); kurulum (karttaki adımların aynısı, ekran adlarıyla); talimat şablonu (uygulamadan kopyalanır, burada yalnızca ne içerdiği); hangi kayıtlar ve sınırlar (Global Constraints'teki değerler); mailler; güvenlik (anahtar şifreli, PR birleştirilmez, hata metni veri sayılır); sorun giderme (`Sonuç gelmedi` → alan adı izni; `bozuk` → anahtarı yenile; 429 → saatte 30 sınırı; Pro ve üstü plan gerekir; özellik önizlemede).
- [ ] **Step 2: Kısa bağlantılar.** `README.md`'de "Kendi backend'ini bağlama" altına yeni başlık "Claude ile otomatik düzeltme" (üç cümle ve bağlantı). `docs/backend.md` tablosunun altına bir paragraf ve bağlantı. `.env.example`'da `APP_URL` satırının açıklaması: `Claude ile otomatik düzeltme için zorunlu`.
- [ ] **Step 3: Commit.** `git commit -m "Belgeler: Claude ile otomatik düzeltme"`

---

### Uçtan uca doğrulama (son)

Gerçek bir Claude hesabı gerekir; bunu proje sahibi yapar ya da onayıyla yapılır:

1. Yayındaki (ya da `APP_URL` tanımlı önizleme) Night Watch'ta Claude'u bağla, "Deneme gönder" → durum `Başarılı`.
2. Deneme deposunda bilerek hata fırlatan bir uç ekle, `nightwatch-node` ile hata gönder.
3. Beklenen: uyarı mailinde oturum bağlantısı; birkaç dakika içinde PR; kayıtta `PR hazır`; sonuç maili.
4. Aynı hatayı yeniden gönder → yeni oturum açılmaz.
