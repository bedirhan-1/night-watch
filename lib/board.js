// Pano arayüzünün saf yardımcıları: sabitler, tarih işlemleri, sıralama, filtreler, haftalık özet.

export const ST = [['acik', 'Açık'], ['devam', 'Devam ediyor'], ['beklemede', 'Beklemede'], ['cozuldu', 'Çözüldü']];
export const PR = [['kritik', 'Kritik'], ['yuksek', 'Yüksek'], ['orta', 'Orta'], ['dusuk', 'Düşük']];
export const CAT = [['gorev', 'Görev'], ['ci', 'CI / Vercel derlemesi'], ['prod', 'Üretim hatası'], ['aws', 'AWS güvenlik olayı'], ['store', 'App Store / TestFlight'], ['diger', 'Diğer']];
export const ENV = [['local', 'local'], ['staging', 'staging'], ['production', 'production']];
export const DST = [['bekliyor', 'Karar bekliyor'], ['verildi', 'Karar verildi'], ['uygulandi', 'Uygulandı']];
export const SRC = { vercel: 'Vercel', github: 'GitHub', apple: 'App Store', aws: 'AWS' };

export const label = (arr, key) => (arr.find((a) => a[0] === key) || [key, key || ''])[1];

const pad = (n) => (n < 10 ? '0' + n : '' + n);
export const ymd = (d) => `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
export const today = () => ymd(new Date());
export const day = (v) => {
  if (!v) return '';
  const s = String(v);
  return s.length === 10 ? s : ymd(new Date(s));
};
const fromYmd = (s) => {
  const p = s.split('-');
  return new Date(+p[0], +p[1] - 1, +p[2]);
};
export function fmt(v, long) {
  const s = day(v);
  if (!s) return '';
  const d = fromYmd(s);
  if (isNaN(d)) return '';
  return d.toLocaleDateString('tr-TR', long ? { day: 'numeric', month: 'long', year: 'numeric', weekday: 'long' } : { day: 'numeric', month: 'short' });
}
export function fmtTime(v) {
  if (!v) return '';
  const d = new Date(v);
  return isNaN(d) ? '' : d.toLocaleString('tr-TR', { dateStyle: 'medium', timeStyle: 'short' });
}
// "3 sa", "2 g", "5 hf" gibi kısa süre. Gün alanları (YYYY-MM-DD) için gün hassasiyetinde.
export function ago(v) {
  if (!v) return '';
  const s = String(v);
  const then = s.length === 10 ? fromYmd(s).getTime() : new Date(s).getTime();
  if (isNaN(then)) return '';
  const min = Math.max(0, Math.floor((Date.now() - then) / 60000));
  if (s.length === 10) {
    const d = Math.floor(min / 1440);
    return d < 1 ? 'bugün' : d < 14 ? `${d} g` : d < 60 ? `${Math.floor(d / 7)} hf` : `${Math.floor(d / 30)} ay`;
  }
  if (min < 1) return 'şimdi';
  if (min < 60) return `${min} dk`;
  if (min < 1440) return `${Math.floor(min / 60)} sa`;
  const d = Math.floor(min / 1440);
  return d < 14 ? `${d} g` : d < 60 ? `${Math.floor(d / 7)} hf` : `${Math.floor(d / 30)} ay`;
}

export const isDone = (r) => r.status === 'cozuldu';
export const isLate = (r) => !isDone(r) && !!r.dueDate && r.dueDate < today();
export const prRank = (r) => {
  const i = ['kritik', 'yuksek', 'orta', 'dusuk'].indexOf(r.priority);
  return i < 0 ? 9 : i;
};
export const initials = (name) =>
  String(name || '')
    .split(/[\s@.]+/)
    .filter(Boolean)
    .slice(0, 2)
    .map((w) => w[0].toLocaleUpperCase('tr'))
    .join('');

export const SORTS = [['oneri', 'Önerilen'], ['guncel', 'Son güncellenen'], ['yeni', 'En yeni'], ['hedef', 'Hedef tarihi']];
export function sortRecs(list, sort = 'oneri') {
  const a = list.slice();
  const upd = (x, y) => String(y.updatedAt || '').localeCompare(String(x.updatedAt || ''));
  if (sort === 'guncel') return a.sort(upd);
  if (sort === 'yeni') return a.sort((x, y) => String(y.createdAt || '').localeCompare(String(x.createdAt || '')) || upd(x, y));
  if (sort === 'hedef') return a.sort((x, y) => String(x.dueDate || '9').localeCompare(String(y.dueDate || '9')) || upd(x, y));
  return a.sort((x, y) => isDone(x) - isDone(y) || isLate(y) - isLate(x) || prRank(x) - prRank(y) || upd(x, y));
}

// Kenar çubuğundaki hazır görünümler.
export const PRESETS = [
  ['open', 'Çözülmemiş'],
  ['crit', 'Kritik'],
  ['late', 'Geciken'],
  ['auto', 'Otomatik bulunanlar'],
  ['done', 'Çözülenler'],
  ['all', 'Tümü'],
];
export function matchPreset(r, preset) {
  if (preset === 'all') return true;
  if (preset === 'done') return isDone(r);
  if (isDone(r)) return false;
  if (preset === 'crit') return r.priority === 'kritik';
  if (preset === 'late') return isLate(r);
  if (preset === 'auto') return !!r.source && r.source !== 'manual';
  if (preset.startsWith('cat:')) return r.category === preset.slice(4);
  return true;
}
export function presetLabel(preset) {
  if (preset.startsWith('cat:')) return label(CAT, preset.slice(4));
  return label(PRESETS, preset);
}
export function applyFilters(records, preset, f) {
  const q = (f.q || '').trim().toLocaleLowerCase('tr');
  return records.filter((r) => {
    if (!matchPreset(r, preset)) return false;
    if (f.status && r.status !== f.status) return false;
    if (f.owner && r.owner !== f.owner) return false;
    if (f.priority && r.priority !== f.priority) return false;
    if (f.area && r.area !== f.area) return false;
    if (q && [r.title, r.errorMessage, r.nextAction, r.expectedFix, r.owner].join(' ').toLocaleLowerCase('tr').indexOf(q) < 0) return false;
    return true;
  });
}
export const uniq = (records, key) =>
  Array.from(new Set(records.map((r) => r[key]).filter(Boolean))).sort((a, b) => a.localeCompare(b, 'tr'));

export function weekRange(off) {
  const d = new Date();
  d.setHours(12, 0, 0, 0);
  d.setDate(d.getDate() - ((d.getDay() + 6) % 7) + off * 7);
  const e = new Date(d);
  e.setDate(e.getDate() + 6);
  return [ymd(d), ymd(e)];
}
export function weekData(records, decisions, off) {
  const [a, b] = weekRange(off);
  const inW = (v) => {
    const s = day(v);
    return !!s && s >= a && s <= b;
  };
  return {
    a,
    b,
    opened: records.filter((r) => inW(r.createdAt)),
    resolved: records.filter((r) => isDone(r) && inW(r.resolvedAt)),
    crit: records.filter((r) => !isDone(r) && r.priority === 'kritik'),
    late: records.filter(isLate),
    dec: decisions.filter((d) => d.status !== 'bekliyor' && inW(d.decidedAt)),
    pend: decisions.filter((d) => d.status === 'bekliyor'),
  };
}
export function weekText(name, w) {
  const L = [`${name} haftalık özet (${fmt(w.a)} – ${fmt(w.b)})`, `Açılan: ${w.opened.length} | Çözülen: ${w.resolved.length} | Açık kritik: ${w.crit.length} | Geciken: ${w.late.length}`];
  const rl = (r) => `${r.title} [${label(PR, r.priority)}, ${label(ST, r.status)}]${r.nextAction && !isDone(r) ? ' → ' + r.nextAction : ''}`;
  const sec = (t, arr, fn) => {
    if (arr.length) {
      L.push('', t + ':');
      arr.forEach((x) => L.push('- ' + fn(x)));
    }
  };
  sec('Çözülenler', w.resolved, rl);
  sec('Açılanlar', w.opened, rl);
  sec('Açık kritikler', w.crit, rl);
  sec('Gecikenler', w.late, rl);
  sec('Verilen kararlar', w.dec, (d) => d.title + (d.note ? ': ' + d.note : ''));
  sec('Karar bekleyenler', w.pend, (d) => d.title);
  return L.join('\n');
}

export const safeUrl = (u) => (/^https?:\/\//i.test(u || '') ? u : '');
