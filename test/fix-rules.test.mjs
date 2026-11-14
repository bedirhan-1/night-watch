import { test } from 'node:test';
import assert from 'node:assert/strict';
import { validFireUrl, validPrUrl, eligible, pickTarget, fireText, routinePrompt, runView, fireRoutine } from '../lib/fix-rules.mjs';

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
