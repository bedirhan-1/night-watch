'use strict';
// Night Watch Node.js SDK. Bağımlılığı yok; Node 18+ (yerleşik fetch).
// Yakalanmayan hataları ve reddedilen promise'leri kendiliğinden yakalar,
// Express ve NestJS için hata katmanı sağlar, aynı hatayı tek kayıtta gruplar.

const os = require('node:os');
const path = require('node:path');

const state = {
  dsn: '',
  options: null,
  pending: new Set(),
  recent: new Map(),
  user: null,
  tags: {},
  installed: false,
};

const ENV_MAP = { production: 'production', prod: 'production', staging: 'staging', stage: 'staging', preview: 'staging', test: 'staging', development: 'local', dev: 'local', local: 'local' };
const LEVELS = ['critical', 'error', 'warning', 'info'];

function log(...args) {
  if (state.options && state.options.debug) console.log('[night-watch]', ...args);
}

function init(options = {}) {
  const dsn = options.dsn || process.env.NIGHTWATCH_DSN || process.env.NIGHTWATCH_URL || '';
  const envName = String(options.environment || process.env.NIGHTWATCH_ENV || process.env.NODE_ENV || 'production').toLowerCase();
  state.dsn = dsn;
  state.options = {
    environment: ENV_MAP[envName] || 'production',
    release: options.release || process.env.NIGHTWATCH_RELEASE || process.env.npm_package_version || '',
    service: options.service || process.env.NIGHTWATCH_SERVICE || '',
    enabled: options.enabled !== undefined ? !!options.enabled : !!dsn,
    captureUnhandled: options.captureUnhandled !== false,
    exitOnUncaught: options.exitOnUncaught !== false,
    dedupeSeconds: options.dedupeSeconds !== undefined ? options.dedupeSeconds : 60,
    timeoutMs: options.timeoutMs || 3000,
    beforeSend: typeof options.beforeSend === 'function' ? options.beforeSend : null,
    debug: !!options.debug,
  };
  if (!dsn) {
    log('DSN yok, hatalar gönderilmeyecek. NIGHTWATCH_DSN ortam değişkenini tanımla.');
  } else if (!/^https?:\/\/.+\/api\/ingest\/[A-Za-z0-9_-]{20,}$/.test(dsn)) {
    console.warn('[night-watch] DSN beklenen biçimde değil: https://<adres>/api/ingest/<anahtar>');
  }
  if (state.options.captureUnhandled && !state.installed) installGlobalHandlers();
  return state.options;
}

function installGlobalHandlers() {
  state.installed = true;
  process.on('uncaughtException', (err) => {
    // Node'un varsayılan davranışı gibi hatayı yazdır; başka dinleyici yoksa gönderip süreci kapat.
    console.error(err);
    captureException(err, { level: 'critical', tags: { mechanism: 'uncaughtException' } });
    const alone = process.listenerCount('uncaughtException') === 1;
    if (state.options.exitOnUncaught && alone) {
      flush(2000).finally(() => process.exit(1));
    }
  });
  process.on('unhandledRejection', (reason) => {
    captureException(reason, { level: 'error', tags: { mechanism: 'unhandledRejection' } });
  });
}

// "    at fn (file:line:col)" ya da "    at file:line:col" satırlarını çözer.
function parseStack(stack) {
  const frames = [];
  for (const line of String(stack || '').split('\n').slice(1)) {
    const m = line.match(/^\s*at (?:(.+?) \()?(.+?):(\d+):(\d+)\)?$/);
    if (!m) continue;
    const file = m[2].replace(/^file:\/\//, '');
    const inApp = !file.includes('node_modules') && !file.startsWith('node:') && !file.startsWith('internal/') && path.isAbsolute(file);
    frames.push({ fn: m[1] || '<anonim>', file: inApp ? path.relative(process.cwd(), file) : file, line: +m[3], inApp });
  }
  return frames;
}

function toError(value) {
  if (value instanceof Error) return value;
  if (typeof value === 'string') return new Error(value);
  let text;
  try {
    text = JSON.stringify(value);
  } catch {
    text = String(value);
  }
  const e = new Error(`Hata olmayan bir değer fırlatıldı: ${text}`);
  e.name = 'NonErrorThrown';
  return e;
}

function requestContext(req) {
  if (!req) return null;
  const headers = req.headers || {};
  return {
    method: req.method,
    url: req.originalUrl || req.url,
    route: req.route && req.route.path,
    userAgent: headers['user-agent'],
  };
}

function buildEvent(error, ctx = {}) {
  const o = state.options;
  const err = toError(error);
  const frames = parseStack(err.stack);
  const top = frames.find((f) => f.inApp) || frames[0];
  const level = LEVELS.includes(ctx.level) ? ctx.level : 'error';
  // Gruplama: hata türü + uygulamadaki ilk stack satırının fonksiyonu ve dosyası.
  // Satır numarası dahil edilmez; kod değişince aynı hata yeni kayıt açmasın.
  const fingerprint = ctx.fingerprint || [err.name, top ? `${top.fn} ${top.file}` : err.message].join(' | ');
  const req = requestContext(ctx.request);
  const tags = Object.assign({}, state.tags, ctx.tags);
  const lines = [];
  if (err.stack) lines.push(err.stack);
  const info = [];
  if (req) info.push(`İstek: ${req.method || ''} ${req.url || ''}${req.route ? ` (rota ${req.route})` : ''}`);
  if (req && req.userAgent) info.push(`Tarayıcı: ${req.userAgent}`);
  const user = ctx.user || state.user;
  if (user) info.push(`Kullanıcı: ${user.id || ''}${user.email ? ` <${user.email}>` : ''}`);
  if (o.release) info.push(`Sürüm: ${o.release}`);
  info.push(`Sunucu: ${os.hostname()} · Node ${process.version}`);
  for (const [k, v] of Object.entries(tags)) info.push(`${k}: ${v}`);
  if (ctx.extra) {
    try {
      info.push(`Ek bilgi: ${JSON.stringify(ctx.extra)}`);
    } catch {}
  }
  lines.push('', ...info);
  return {
    title: `${err.name}: ${err.message}`.slice(0, 200),
    message: lines.join('\n').slice(0, 6000),
    level,
    environment: o.environment,
    service: ctx.service || o.service,
    fingerprint: fingerprint.slice(0, 200),
  };
}

function isDuplicate(fingerprint) {
  const sec = state.options.dedupeSeconds;
  if (!sec) return false;
  const now = Date.now();
  const last = state.recent.get(fingerprint);
  state.recent.set(fingerprint, now);
  if (state.recent.size > 500) state.recent.delete(state.recent.keys().next().value);
  return last !== undefined && now - last < sec * 1000;
}

async function send(event, attempt = 1) {
  try {
    const r = await fetch(state.dsn, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', 'User-Agent': 'nightwatch-node/0.1.1' },
      body: JSON.stringify(event),
      signal: AbortSignal.timeout(state.options.timeoutMs),
    });
    if (r.status >= 500 && attempt < 2) {
      await new Promise((res) => setTimeout(res, 1000));
      return send(event, attempt + 1);
    }
    if (!r.ok) log(`gönderilemedi: HTTP ${r.status}`);
    else log('gönderildi:', event.title);
  } catch (e) {
    if (attempt < 2) {
      await new Promise((res) => setTimeout(res, 1000));
      return send(event, attempt + 1);
    }
    log('gönderilemedi:', e && e.message);
  }
}

// Hatayı gönderir. Uygulamayı asla durdurmaz; gönderim arka planda olur.
function captureException(error, ctx = {}) {
  if (!state.options) init();
  if (!state.options.enabled || !state.dsn) return null;
  let event;
  try {
    event = buildEvent(error, ctx);
    if (state.options.beforeSend) {
      event = state.options.beforeSend(event, error);
      if (!event) return null;
    }
  } catch (e) {
    log('olay hazırlanamadı:', e && e.message);
    return null;
  }
  if (isDuplicate(event.fingerprint)) {
    log('kısa süre önce gönderildi, atlandı:', event.title);
    return null;
  }
  const p = send(event).finally(() => state.pending.delete(p));
  state.pending.add(p);
  return event.fingerprint;
}

function captureMessage(message, level = 'info', ctx = {}) {
  const err = new Error(String(message));
  err.name = 'Message';
  return captureException(err, Object.assign({}, ctx, { level }));
}

// Bekleyen gönderimleri en fazla timeoutMs kadar bekler. Süreç kapanmadan önce çağır.
async function flush(timeoutMs = 2000) {
  if (!state.pending.size) return true;
  let timer;
  const timeout = new Promise((res) => {
    timer = setTimeout(() => res(false), timeoutMs);
  });
  const done = Promise.allSettled([...state.pending]).then(() => true);
  const result = await Promise.race([done, timeout]);
  clearTimeout(timer);
  return result;
}

function setUser(user) {
  state.user = user || null;
}

function setTag(key, value) {
  if (value === undefined || value === null) delete state.tags[key];
  else state.tags[key] = String(value);
}

// Express: tüm rotalardan sonra, kendi hata katmanından önce ekle.
// Yalnızca 500 ve üstü durum kodlu hatalar gönderilir; 4xx çoğunlukla kullanıcı kaynaklıdır.
function expressErrorHandler(opts = {}) {
  const minStatus = opts.minStatus || 500;
  return function nightWatchErrorHandler(err, req, res, next) {
    const status = (err && (err.status || err.statusCode)) || 500;
    if (status >= minStatus) captureException(err, { request: req });
    next(err);
  };
}

module.exports = { init, captureException, captureMessage, flush, setUser, setTag, expressErrorHandler, _internal: { parseStack, buildEvent, state } };
