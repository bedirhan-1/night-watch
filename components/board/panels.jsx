'use client';

import { useEffect, useState } from 'react';
import { Check, ChevronLeft, ChevronRight, Copy, ExternalLink, LogOut, Mail, Play, Plus, RotateCcw, Trash2 } from 'lucide-react';
import { GUIDES } from '@/lib/guides';
import { cn } from '@/lib/cn';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Input, Textarea } from '@/components/ui/input';
import { Empty, Field, PriorityBadge, StatusBadge, LateBadge, OwnerPick, Avatar, ownerLabel, usePeople } from './bits';
import { DST, LOG_KINDS, label, fmt, fmtTime, fmtClock, day, today, weekData, weekText } from '@/lib/board';
import { Pick } from './bits';

function Section({ title, count, action, children }) {
  return (
    <section className="flex flex-col gap-2">
      <h3 className="flex items-center justify-between gap-2 text-sm font-semibold">
        <span>
          {title}
          {count != null ? <span className="ml-2 text-xs font-normal tabular-nums text-muted-foreground">{count}</span> : null}
        </span>
        {action}
      </h3>
      {children}
    </section>
  );
}

const rowCls = 'flex w-full flex-col gap-1.5 rounded-md border bg-card px-3.5 py-2.5 text-left outline-none hover:border-primary focus-visible:ring-2 focus-visible:ring-ring';

function RecRow({ r, onOpen }) {
  return (
    <button type="button" className={rowCls} onClick={() => onOpen(r)}>
      <span className="break-words text-sm font-medium">{r.title}</span>
      <span className="flex flex-wrap gap-1.5">
        <LateBadge record={r} />
        <PriorityBadge priority={r.priority} />
        <StatusBadge status={r.status} />
      </span>
    </button>
  );
}

const DV = { bekliyor: 'high', verildi: 'primary', uygulandi: 'done' };
const DB = { bekliyor: 'border-l-high', verildi: 'border-l-primary', uygulandi: 'border-l-done' };

function DecRow({ d, onOpen }) {
  const people = usePeople();
  return (
    <button type="button" className={cn(rowCls, 'border-l-[3px]', DB[d.status])} onClick={() => onOpen(d)}>
      <span className="break-words text-sm font-medium">{d.title}</span>
      {d.note ? <span className="whitespace-pre-wrap break-words text-[13px] text-muted-foreground">{d.note}</span> : null}
      <span className="flex flex-wrap items-center gap-1.5">
        <Badge variant={DV[d.status]}>{label(DST, d.status)}</Badge>
        {d.owner ? <Badge>{ownerLabel(people, d.owner)}</Badge> : null}
        {d.decidedAt ? <span className="text-xs text-muted-foreground">karar {fmt(d.decidedAt)}</span> : null}
      </span>
    </button>
  );
}

function List({ items, empty, render }) {
  return items.length ? <div className="flex flex-col gap-2">{items.map(render)}</div> : <Empty className="py-5">{empty}</Empty>;
}

const STAT = { acc: 'text-link', done: 'text-done', crit: 'text-crit', warn: 'text-high' };
function Stat({ n, text, tone }) {
  return (
    <div className="rounded-lg border bg-card px-4 py-3">
      <b className={cn('block text-[26px] font-semibold leading-tight tabular-nums', STAT[tone])}>{n}</b>
      <span className="text-[13px] text-muted-foreground">{text}</span>
    </div>
  );
}

export function WeekPanel({ projectName, records, decisions, logs = [], onOpenRecord, onOpenDecision, onOpenLog, toast }) {
  const [off, setOff] = useState(0);
  const w = weekData(records, decisions, off);
  const weekLogs = logs.filter((l) => {
    const d = day(l.loggedAt);
    return d >= w.a && d <= w.b;
  });
  async function copy() {
    try {
      await navigator.clipboard.writeText(weekText(projectName || 'Proje', w, weekLogs.slice().reverse()));
      toast('Haftalık özet kopyalandı.');
    } catch {
      toast('Kopyalanamadı.');
    }
  }
  return (
    <div className="flex flex-col gap-4">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <h2 className="text-lg font-semibold">
          {fmt(w.a)} – {fmt(w.b)}
          {off === 0 ? <span className="ml-2 text-xs font-normal text-muted-foreground">bu hafta</span> : null}
        </h2>
        <div className="flex gap-2">
          <Button variant="outline" size="icon" aria-label="Önceki hafta" onClick={() => setOff(off - 1)}>
            <ChevronLeft />
          </Button>
          <Button variant="outline" size="icon" aria-label="Sonraki hafta" disabled={off >= 0} onClick={() => setOff(Math.min(0, off + 1))}>
            <ChevronRight />
          </Button>
          <Button variant="outline" onClick={copy}>
            <Copy /> Özeti kopyala
          </Button>
        </div>
      </div>
      <div className="grid grid-cols-2 gap-2.5 md:grid-cols-4">
        <Stat n={w.opened.length} text="bu hafta açılan" tone="acc" />
        <Stat n={w.resolved.length} text="bu hafta çözülen" tone="done" />
        <Stat n={w.crit.length} text="açık kritik (şu an)" tone="crit" />
        <Stat n={w.late.length} text="geciken (şu an)" tone="warn" />
      </div>
      <div className="grid gap-5 lg:grid-cols-2">
        <Section title="Çözülenler" count={w.resolved.length}>
          <List items={w.resolved} empty="Bu hafta çözülen kayıt yok." render={(r) => <RecRow key={r.id} r={r} onOpen={onOpenRecord} />} />
        </Section>
        <Section title="Açılanlar" count={w.opened.length}>
          <List items={w.opened} empty="Bu hafta açılan kayıt yok." render={(r) => <RecRow key={r.id} r={r} onOpen={onOpenRecord} />} />
        </Section>
        <Section title="Bu hafta verilen kararlar" count={w.dec.length}>
          <List items={w.dec} empty="Bu hafta karar kaydı yok." render={(d) => <DecRow key={d.id} d={d} onOpen={onOpenDecision} />} />
        </Section>
        <Section title="Karar bekleyen maddeler" count={w.pend.length}>
          <List items={w.pend} empty="Bekleyen madde yok." render={(d) => <DecRow key={d.id} d={d} onOpen={onOpenDecision} />} />
        </Section>
      </div>
      <Section title="Bu haftanın günlüğü" count={weekLogs.length}>
        <List items={weekLogs} empty="Bu hafta günlüğe bir şey yazılmamış." render={(l) => <LogRow key={l.id} l={l} onOpen={onOpenLog} showDate />} />
      </Section>
    </div>
  );
}

const LV = { yayin: 'primary', degisiklik: 'high', olay: 'crit', not: 'default' };

function LogRow({ l, onOpen, showDate }) {
  return (
    <button type="button" className={cn(rowCls, 'flex-row items-start gap-3')} onClick={() => onOpen(l)}>
      <span className="w-12 shrink-0 pt-0.5 text-xs tabular-nums text-muted-foreground">
        {showDate ? <span className="block">{fmt(l.loggedAt)}</span> : null}
        {fmtClock(l.loggedAt)}
      </span>
      <span className="flex min-w-0 flex-1 flex-col gap-1.5">
        <span className="break-words text-sm font-medium">{l.title}</span>
        {l.note ? <span className="whitespace-pre-wrap break-words text-[13px] text-muted-foreground">{l.note}</span> : null}
        <span>
          <Badge variant={LV[l.kind] || 'default'}>{label(LOG_KINDS, l.kind)}</Badge>
        </span>
      </span>
      <Avatar name={l.author} className="size-6 text-[10px]" />
    </button>
  );
}

// Elle tutulan günlük: ne yaptığını tek satırla yaz, sonradan tarihe göre geri dön.
export function LogPanel({ logs, onAdd, onOpen }) {
  const [text, setText] = useState('');
  const [kind, setKind] = useState('');
  const [filter, setFilter] = useState('');
  const [q, setQ] = useState('');
  const [busy, setBusy] = useState(false);
  // Tür seçilmediyse varsayılan "Olay"dır; sürüm ya da yayın geçen satırlar "Yayın" sayılır.
  const guess = /(yayın|sürüm|versiyon|release|deploy|\bv?\d+\.\d+)/i.test(text) ? 'yayin' : 'olay';
  const effective = kind || guess;
  async function submit(e) {
    e.preventDefault();
    const title = text.trim();
    if (!title || busy) return;
    setBusy(true);
    const ok = await onAdd({ title, kind: effective, loggedAt: new Date().toISOString() });
    setBusy(false);
    if (ok) {
      setText('');
      setKind('');
    }
  }
  const needle = q.trim().toLocaleLowerCase('tr');
  const list = logs.filter((l) => (!filter || l.kind === filter) && (!needle || `${l.title} ${l.note}`.toLocaleLowerCase('tr').includes(needle)));
  const groups = {};
  list.forEach((l) => (groups[day(l.loggedAt)] = groups[day(l.loggedAt)] || []).push(l));
  const t = today();
  return (
    <div className="flex max-w-3xl flex-col gap-5">
      <form onSubmit={submit} className="flex flex-col gap-2 rounded-lg border bg-card p-3">
        <label htmlFor="log-text" className="text-xs font-medium text-muted-foreground">
          Ne yaptın?
        </label>
        <div className="flex flex-wrap gap-2">
          <Input id="log-text" className="min-w-52 flex-1" placeholder="Örn. 1.0.2 sürümünü yayınladım" value={text} onChange={(e) => setText(e.target.value)} maxLength={300} />
          <Pick className="w-36" ariaLabel="Tür" value={effective} onChange={setKind} options={LOG_KINDS} />
          <Button type="submit" disabled={busy || !text.trim()}>
            <Plus /> Ekle
          </Button>
        </div>
        <p className="text-xs text-muted-foreground">Şu anın tarihi ve saatiyle kaydedilir. Ayrıntı eklemek ya da tarihi değiştirmek için kayda tıkla.</p>
      </form>

      {logs.length ? (
        <div className="flex flex-wrap items-center gap-2">
          <Input className="min-w-44 flex-1 sm:max-w-xs" type="search" aria-label="Günlükte ara" placeholder="Günlükte ara" value={q} onChange={(e) => setQ(e.target.value)} />
          <Pick className="w-40" ariaLabel="Türe göre süz" value={filter} onChange={setFilter} options={LOG_KINDS} placeholder="Tüm türler" />
          <span className="text-[13px] tabular-nums text-muted-foreground">{list.length} kayıt</span>
        </div>
      ) : null}

      {!logs.length ? <Empty>Günlük boş. Yaptığın ilk işi yukarıya yaz.</Empty> : null}
      {logs.length && !list.length ? <Empty>Aramana uyan günlük kaydı yok.</Empty> : null}
      {Object.keys(groups)
        .sort()
        .reverse()
        .map((d) => (
          <Section key={d} title={(d === t ? 'Bugün · ' : '') + fmt(d, true)} count={groups[d].length}>
            <div className="flex flex-col gap-2">
              {groups[d].map((l) => (
                <LogRow key={l.id} l={l} onOpen={onOpen} />
              ))}
            </div>
          </Section>
        ))}
    </div>
  );
}

export function DecisionsPanel({ decisions, onOpen, onNew }) {
  const by = (s) =>
    decisions.filter((d) => d.status === s).sort((a, b) => String(b.decidedAt || b.createdAt || '').localeCompare(String(a.decidedAt || a.createdAt || '')));
  return (
    <div className="flex flex-col gap-5">
      <div>
        <Button onClick={onNew}>
          <Plus /> Karar maddesi
        </Button>
      </div>
      {DST.map(([key, text]) => {
        const items = by(key);
        return (
          <Section key={key} title={text} count={items.length}>
            <List items={items} empty="Madde yok." render={(d) => <DecRow key={d.id} d={d} onOpen={onOpen} />} />
          </Section>
        );
      })}
    </div>
  );
}

export function RemindersPanel({ reminders, onOpen, onNew, onToggle }) {
  const t = today();
  const pending = reminders.filter((m) => !m.done).sort((a, b) => String(a.dueDate || '9').localeCompare(String(b.dueDate || '9')));
  const done = reminders.filter((m) => m.done);
  const row = (m) => {
    const late = !m.done && m.dueDate && m.dueDate < t;
    const due = !m.done && m.dueDate === t;
    return (
      <div key={m.id} className={cn('flex items-start gap-3 rounded-md border bg-card px-3.5 py-2.5', m.done && 'opacity-60')}>
        <button
          type="button"
          aria-label={m.done ? 'Geri al' : 'Tamamlandı olarak işaretle'}
          onClick={() => onToggle(m)}
          className={cn(
            'mt-0.5 flex size-5 shrink-0 items-center justify-center rounded border outline-none focus-visible:ring-2 focus-visible:ring-ring',
            m.done ? 'border-primary bg-primary text-primary-foreground' : 'border-input hover:border-ring',
          )}
        >
          {m.done ? <Check className="size-3.5" /> : null}
        </button>
        <button type="button" onClick={() => onOpen(m)} className="flex min-w-0 flex-1 flex-col gap-1 rounded text-left outline-none focus-visible:ring-2 focus-visible:ring-ring">
          <span className={cn('break-words text-sm font-medium', m.done && 'line-through')}>{m.title}</span>
          {m.note ? <span className="whitespace-pre-wrap break-words text-[13px] text-muted-foreground">{m.note}</span> : null}
          <span>
            {m.dueDate ? (
              <Badge variant={late ? 'solid' : due ? 'high' : 'default'}>
                {late ? 'Gecikti · ' : due ? 'Bugün · ' : ''}
                {fmt(m.dueDate)}
              </Badge>
            ) : (
              <Badge>tarihsiz</Badge>
            )}
          </span>
        </button>
      </div>
    );
  };
  return (
    <div className="flex flex-col gap-5">
      <div className="flex flex-col gap-2">
        <div>
          <Button onClick={onNew}>
            <Plus /> Hatırlatma
          </Button>
        </div>
        <p className="text-[13px] text-muted-foreground">Tarihi gelen hatırlatmalar, tamamlandı işaretlenene kadar her sabah mail özetine girer.</p>
      </div>
      <Section title="Bekleyen" count={pending.length}>
        <List items={pending} empty="Bekleyen hatırlatma yok." render={row} />
      </Section>
      <Section title="Tamamlanan" count={done.length}>
        <List items={done} empty="Tamamlanan yok." render={row} />
      </Section>
    </div>
  );
}

// [alan, etiket, tür] — tür: 0 düz metin, 1 gizli tek satır, 2 gizli çok satır, 3 düz çok satır
const isSecret = (f) => f[2] === 1 || f[2] === 2;
const EVERY = [['5', '5 dakikada bir'], ['15', '15 dakikada bir'], ['60', 'Saatte bir'], ['360', '6 saatte bir']];
const FIX_MODES = [['otomatik', 'Otomatik (yeni backend hatalarında)'], ['elle', 'Yalnızca elle'], ['kapali', 'Kapalı']];
const ALERT_MODES = [['hepsi', 'Yeni her otomatik kayıtta'], ['kritik', 'Yalnızca kritik olanlarda'], ['kapali', 'Gönderme (yalnızca sabah özeti)']];
const SVCF = {
  http: [['httpUrls', 'Kontrol edilecek adresler (her satıra bir adres)', 3]],
  vercel: [['vercelToken', 'Token', 1], ['vercelTeamId', 'Takım ID (isteğe bağlı)', 0], ['vercelProjects', 'Vercel proje adları (virgülle; boşsa hepsi)', 0]],
  github: [['githubToken', 'Token', 1], ['githubRepos', 'Depolar (sahip/depo ya da sahip/*, virgülle)', 0]],
  apple: [['ascKeyId', 'Key ID', 0], ['ascIssuerId', 'Issuer ID', 0], ['ascPrivateKey', '.p8 dosyasının içeriği', 2], ['ascAppId', 'App ID (isteğe bağlı)', 0]],
  aws: [['awsAccessKeyId', 'Access key ID', 0], ['awsSecretAccessKey', 'Secret access key', 1]],
};

function Confirm({ children, confirmText, onConfirm, ...props }) {
  const [sure, setSure] = useState(false);
  return (
    <Button variant="destructive" onClick={() => (sure ? onConfirm() : setSure(true))} onBlur={() => setSure(false)} {...props}>
      {sure ? confirmText : children}
    </Button>
  );
}

const linkCls = 'inline-flex items-center gap-1 text-link underline-offset-4 hover:underline';

// Servisin nasıl bağlanacağını adım adım anlatır; bağlantılar ilgili sayfayı yeni sekmede açar.
function Guide({ service }) {
  const g = GUIDES[service];
  if (!g) return null;
  return (
    <div className="rounded-md border bg-chrome/60 px-3.5 py-3 text-[13px] leading-relaxed">
      <p className="text-muted-foreground">
        <span className="font-medium text-foreground">Neye bakar: </span>
        {g.checks}
      </p>
      <p className="mt-2.5 font-medium">Nasıl bağlanır</p>
      <ol className="mt-1 list-decimal space-y-1.5 pl-5 text-muted-foreground marker:text-link">
        {g.steps.map(([text, linkText, url], i) => (
          <li key={i}>
            {text}{' '}
            {url ? (
              <a href={url} target="_blank" rel="noopener noreferrer" className={linkCls}>
                {linkText} <ExternalLink className="size-3" />
              </a>
            ) : null}
          </li>
        ))}
      </ol>
      <a href={g.docs[1]} target="_blank" rel="noopener noreferrer" className={cn(linkCls, 'mt-2.5')}>
        {g.docs[0]} <ExternalLink className="size-3" />
      </a>
    </div>
  );
}

function ServiceCard({ s, admin, creds, onSave, onClear }) {
  const [open, setOpen] = useState(false);
  const [vals, setVals] = useState({});
  useEffect(() => {
    setVals({});
  }, [creds]);
  const fields = SVCF[s.key];
  const value = (f) => (vals[f[0]] != null ? vals[f[0]] : isSecret(f) ? '' : creds.values[f[0]] || '');
  const everyKey = `${s.key}Every`;
  const every = vals[everyKey] != null ? vals[everyKey] : creds.values[everyKey] || '';
  function save() {
    const out = {};
    fields.forEach((f) => {
      const v = String(value(f)).trim();
      if (isSecret(f) && !v) return;
      out[f[0]] = v;
    });
    out[everyKey] = every;
    onSave(out);
  }
  return (
    <div className="rounded-lg border bg-card">
      <div className="flex flex-wrap items-center justify-between gap-2 px-4 py-3">
        <div className="min-w-0">
          <div className="text-sm font-medium">{s.label}</div>
          {s.message || s.ranAt ? (
            <div className="mt-0.5 break-words text-[13px] text-muted-foreground">
              {s.message}
              {s.ranAt ? ` · ${fmtTime(s.ranAt)}` : ''}
            </div>
          ) : null}
        </div>
        <div className="flex items-center gap-2">
          {s.configured && s.every ? <Badge variant="primary">{label(EVERY, String(s.every))}</Badge> : null}
          {!s.configured ? <Badge>Bağlı değil</Badge> : !s.ranAt ? <Badge>Henüz çalışmadı</Badge> : s.ok ? <Badge variant="done">Çalışıyor</Badge> : <Badge variant="crit">Hata</Badge>}
          {admin ? (
            <Button variant="outline" size="sm" aria-expanded={open} onClick={() => setOpen(!open)}>
              {s.configured ? 'Düzenle' : 'Bağla'}
            </Button>
          ) : null}
        </div>
      </div>
      {admin && open ? (
        <div className="grid gap-3 border-t px-4 py-3.5">
          <Guide service={s.key} />
          {fields.map((f) => {
            const id = `cred-${f[0]}`;
            const ph = isSecret(f) && creds.set[f[0]] ? 'Kayıtlı. Değiştirmek için yeni değer gir' : f[2] === 3 ? 'https://api.ornek.com/health' : '';
            const common = { id, value: value(f), placeholder: ph, autoComplete: 'off', onChange: (e) => setVals({ ...vals, [f[0]]: e.target.value }) };
            return (
              <Field key={f[0]} label={f[1]} htmlFor={id}>
                {f[2] >= 2 ? <Textarea className="font-mono text-[13px]" {...common} /> : <Input type={f[2] ? 'password' : 'text'} {...common} />}
              </Field>
            );
          })}
          <Field label="Kontrol sıklığı" htmlFor={`every-${s.key}`}>
            <Pick id={`every-${s.key}`} className="sm:max-w-xs" value={every} onChange={(v) => setVals({ ...vals, [everyKey]: v })} options={EVERY} placeholder="Günde bir (sabah 08:00)" />
            <span className="text-xs text-muted-foreground">Günde birden sık kontrol, bir zamanlayıcı kurulduysa çalışır (bkz. docs/backend.md). Yeni sorun bulunursa anında mail gider.</span>
          </Field>
          <div className="flex flex-wrap gap-2">
            <Button size="sm" onClick={save}>
              Kaydet
            </Button>
            {s.configured ? (
              <Confirm size="sm" confirmText="Emin misin? Kaldır" onConfirm={onClear}>
                Bağlantıyı kaldır
              </Confirm>
            ) : null}
          </div>
        </div>
      ) : null}
    </div>
  );
}

// Kullanıcının kendi görünen adı ve avatarı. Görsel tarayıcıda 96x96'ya küçültülüp öyle gönderilir.
function ProfileSection({ me, onSave }) {
  const [name, setName] = useState('');
  const [avatar, setAvatar] = useState('');
  const [error, setError] = useState('');
  useEffect(() => {
    setName((me && me.name) || '');
    setAvatar((me && me.avatar) || '');
  }, [me && me.name, me && me.avatar]);
  function pickFile(e) {
    const file = e.target.files && e.target.files[0];
    e.target.value = '';
    if (!file) return;
    setError('');
    const url = URL.createObjectURL(file);
    const img = new Image();
    img.onload = () => {
      const size = 96;
      const c = document.createElement('canvas');
      c.width = size;
      c.height = size;
      const side = Math.min(img.width, img.height);
      c.getContext('2d').drawImage(img, (img.width - side) / 2, (img.height - side) / 2, side, side, 0, 0, size, size);
      URL.revokeObjectURL(url);
      setAvatar(c.toDataURL('image/jpeg', 0.82));
    };
    img.onerror = () => {
      URL.revokeObjectURL(url);
      setError('Bu dosya görsel olarak açılamadı.');
    };
    img.src = url;
  }
  if (!me) return null;
  return (
    <Section title="Profilin">
      <form
        className="flex flex-col gap-3 rounded-lg border bg-card p-4"
        onSubmit={(e) => {
          e.preventDefault();
          onSave({ name, avatar });
        }}
      >
        <div className="flex flex-wrap items-center gap-4">
          <Avatar name={name || me.email} src={avatar} className="size-14 text-base" />
          <div className="flex flex-wrap gap-2">
            <Button asChild variant="outline" size="sm">
              <label htmlFor="profile-avatar" className="cursor-pointer">
                Avatar seç
              </label>
            </Button>
            <input id="profile-avatar" type="file" accept="image/*" className="sr-only" onChange={pickFile} />
            {avatar ? (
              <Button variant="ghost" size="sm" onClick={() => setAvatar('')}>
                Avatarı kaldır
              </Button>
            ) : null}
          </div>
        </div>
        <Field label="Görünen ad" htmlFor="profile-name" className="max-w-sm">
          <Input id="profile-name" maxLength={40} placeholder={me.email.split('@')[0]} value={name} onChange={(e) => setName(e.target.value)} />
        </Field>
        {error ? <span className="text-xs text-crit">{error}</span> : null}
        <div className="flex flex-wrap items-center gap-3">
          <Button type="submit">Kaydet</Button>
          <span className="text-[13px] text-muted-foreground">{me.email} · Ad ve avatar, üyesi olduğun tüm projelerde sorumlu olarak göründüğün yerlerde kullanılır.</span>
        </div>
      </form>
    </Section>
  );
}

const preCls = 'overflow-x-auto rounded-md border bg-chrome px-3 py-2.5 font-mono text-[12px] leading-relaxed text-muted-foreground';

// Kendi backend'inden hata göndermek için adres ve örnek kod.
function IngestCard({ url, onRegen, toast }) {
  const [open, setOpen] = useState(false);
  if (!url) return null;
  async function copy(text, what) {
    try {
      await navigator.clipboard.writeText(text);
      toast(`${what} kopyalandı.`);
    } catch {
      toast('Kopyalanamadı.');
    }
  }
  const curl = `curl -X POST "${url}" \\\n  -H "Content-Type: application/json" \\\n  -d '{"title":"Ödeme servisi 500 dönüyor","level":"error","environment":"production","service":"api","message":"TypeError: ..."}'`;
  const env = `NIGHTWATCH_DSN=${url}`;
  const nest = `// npm install nightwatch-node
// main.ts
import * as nightwatch from 'nightwatch-node';
import { NightWatchFilter } from 'nightwatch-node/nestjs';
import { HttpAdapterHost, NestFactory } from '@nestjs/core';

nightwatch.init({ service: 'api' }); // NIGHTWATCH_DSN ortam değişkenini okur

async function bootstrap() {
  const app = await NestFactory.create(AppModule);
  const { httpAdapter } = app.get(HttpAdapterHost);
  app.useGlobalFilters(new NightWatchFilter(httpAdapter));
  await app.listen(3000);
}
bootstrap();`;
  const express = `const nightwatch = require('nightwatch-node');
nightwatch.init({ service: 'api' });
// ...rotalarından sonra:
app.use(nightwatch.expressErrorHandler());`;
  return (
    <div className="rounded-lg border bg-card">
      <div className="flex flex-wrap items-center justify-between gap-2 px-4 py-3">
        <div className="min-w-0">
          <div className="text-sm font-medium">Kendi backend'inden hata gönder</div>
          <div className="mt-0.5 text-[13px] text-muted-foreground">Backend'in bir hata yakaladığında bu adrese istek atar; hata kayıt olarak açılır ve mail gider.</div>
        </div>
        <Button variant="outline" size="sm" aria-expanded={open} onClick={() => setOpen(!open)}>
          {open ? 'Gizle' : 'Nasıl bağlanır'}
        </Button>
      </div>
      {open ? (
        <div className="grid gap-3 border-t px-4 py-3.5 text-[13px]">
          <Field label="Hata gönderme adresi (gizli tut)" htmlFor="ingest-url">
            <div className="flex gap-2">
              <Input id="ingest-url" readOnly value={url} className="font-mono text-[12px]" onFocus={(e) => e.target.select()} />
              <Button variant="outline" onClick={() => copy(url, 'Adres')}>
                <Copy /> Kopyala
              </Button>
            </div>
          </Field>
          <p className="leading-relaxed text-muted-foreground">
            Sentry gibi: <b className="text-foreground">nightwatch-node</b> paketini kur, adresi ortam değişkenine koy, uygulama açılırken bir kez başlat. Yakalanmayan hatalar ve 500 hataları kendiliğinden gelir; aynı hata tek kayıtta
            toplanır ve sayacı artar, çözülmüş bir hata yeniden gelirse kayıt yeniden açılır ve mail gider.
          </p>
          <div className="flex items-center justify-between">
            <span className="font-medium">1. Ortam değişkeni</span>
            <Button variant="ghost" size="sm" onClick={() => copy(env, 'Satır')}>
              <Copy /> Kopyala
            </Button>
          </div>
          <pre className={preCls}>{env}</pre>
          <div className="flex items-center justify-between">
            <span className="font-medium">2. NestJS</span>
            <Button variant="ghost" size="sm" onClick={() => copy(nest, 'Kod')}>
              <Copy /> Kopyala
            </Button>
          </div>
          <pre className={preCls}>{nest}</pre>
          <div className="flex items-center justify-between">
            <span className="font-medium">Express kullanıyorsan</span>
            <Button variant="ghost" size="sm" onClick={() => copy(express, 'Kod')}>
              <Copy /> Kopyala
            </Button>
          </div>
          <pre className={preCls}>{express}</pre>
          <div className="flex items-center justify-between">
            <span className="font-medium">Paketsiz, terminalden dene</span>
            <Button variant="ghost" size="sm" onClick={() => copy(curl, 'Komut')}>
              <Copy /> Kopyala
            </Button>
          </div>
          <pre className={preCls}>{curl}</pre>
          <div className="flex flex-wrap items-center gap-3">
            <a href="https://github.com/bedirhan-1/night-watch/blob/main/sdk/node/README.md" target="_blank" rel="noopener noreferrer" className={linkCls}>
              Paket belgeleri <ExternalLink className="size-3" />
            </a>
            <a href="https://github.com/bedirhan-1/night-watch/blob/main/docs/backend.md" target="_blank" rel="noopener noreferrer" className={linkCls}>
              Backend rehberi <ExternalLink className="size-3" />
            </a>
            <Confirm size="sm" confirmText="Emin misin? Eski adres çalışmaz" onConfirm={onRegen}>
              Adresi yenile
            </Confirm>
          </div>
        </div>
      ) : null}
    </div>
  );
}

const TEST_STATE = {
  calisiyor: 'Deneme gönderildi, Claude yanıtı bekleniyor. Birkaç dakika sonra sayfayı yenile.',
  tamam: 'Son deneme başarılı: Claude ulaştı ve sonucu bildirdi.',
  sonuc_yok: 'Son denemede Claude sonuç bildirmedi. Bulut ortamının izinli alan adlarını kontrol et.',
  tetiklenemedi: 'Son deneme başlatılamadı',
};

// Üyenin kendi Claude Code bulut görevini projeye bağladığı kart. Herkes yalnızca kendi bağlantısını görür.
function ClaudeCard({ claude, onSave, onTest, onRemove, toast }) {
  const [open, setOpen] = useState(false);
  const [fireUrl, setFireUrl] = useState('');
  const [token, setToken] = useState('');
  const [busy, setBusy] = useState(false);
  const savedUrl = (claude && claude.fireUrl) || '';
  useEffect(() => {
    setFireUrl(savedUrl);
  }, [savedUrl]);
  if (!claude) return null;
  async function copy(text, what) {
    try {
      await navigator.clipboard.writeText(text);
      toast(`${what} kopyalandı.`);
    } catch {
      toast('Kopyalanamadı.');
    }
  }
  async function act(fn) {
    setBusy(true);
    const ok = await fn();
    setBusy(false);
    return ok;
  }
  const test = claude.lastTest;
  const stepCls = 'flex items-center justify-between gap-2';
  return (
    <div className="rounded-lg border bg-card">
      <div className="flex flex-wrap items-center justify-between gap-2 px-4 py-3">
        <div className="min-w-0">
          <div className="flex flex-wrap items-center gap-2 text-sm font-medium">
            Claude'u bağla
            {claude.linked ? claude.broken ? <Badge variant="crit">Bağlantı çalışmıyor</Badge> : <Badge variant="done">Bağlı</Badge> : null}
          </div>
          <div className="mt-0.5 text-[13px] text-muted-foreground">
            Backend'inden yeni bir hata geldiğinde kendi Claude'un haberdar olur, depoyu inceler, düzeltir ve PR açar. Bilgisayarının açık olması gerekmez.
          </div>
        </div>
        <Button variant="outline" size="sm" aria-expanded={open} onClick={() => setOpen(!open)}>
          {open ? 'Gizle' : claude.linked ? 'Düzenle' : 'Nasıl bağlanır'}
        </Button>
      </div>
      {open && !claude.ready ? (
        <div className="border-t px-4 py-3.5 text-[13px] text-muted-foreground">
          Bu özellik için sunucuda <code className="text-foreground">APP_URL</code> ortam değişkeni tanımlı olmalı (örn. https://night-watch.vercel.app). Claude sonucu bu adrese bildirir.
        </div>
      ) : null}
      {open && claude.ready ? (
        <div className="grid gap-3 border-t px-4 py-3.5 text-[13px]">
          {claude.broken ? <p className="rounded-md border border-crit/50 bg-crit/10 px-3 py-2 text-crit">Görev son isteği kabul etmedi: {claude.broken}. Adresi ve anahtarı yenile.</p> : null}
          <p className="leading-relaxed text-muted-foreground">
            Claude kendi hesabında, bulutta çalışır ve kullanım kendi Claude planından düşer (Pro ve üstü). PR açar; birleştirmez. Kayıt başına en fazla 2 otomatik deneme, proje başına günde en fazla 10.
          </p>
          <div>
            <span className="font-medium">1. Görevi aç</span>
            <p className="mt-1 text-muted-foreground">
              <a href="https://claude.ai/code/routines" target="_blank" rel="noopener noreferrer" className="inline-flex items-center gap-1 text-link hover:underline">
                claude.ai/code/routines <ExternalLink className="size-3.5" />
              </a>{' '}
              sayfasında yeni bir görev oluştur ve backend deponu (gerekirse birden çok depo) seç.
            </p>
          </div>
          <div className={stepCls}>
            <span className="font-medium">2. Talimat olarak şunu yapıştır</span>
            <Button variant="ghost" size="sm" onClick={() => copy(claude.prompt, 'Talimat')}>
              <Copy /> Kopyala
            </Button>
          </div>
          <pre className={cn(preCls, 'max-h-56 whitespace-pre-wrap')}>{claude.prompt}</pre>
          <div className={stepCls}>
            <span className="font-medium">3. Bulut ortamının izinli alan adlarına şunu ekle</span>
            <Button variant="ghost" size="sm" onClick={() => copy(claude.host, 'Alan adı')}>
              <Copy /> Kopyala
            </Button>
          </div>
          <pre className={preCls}>{claude.host}</pre>
          <p className="text-muted-foreground">Görevde Advanced settings &gt; Cloud environment &gt; ortamın ayarları &gt; Allowed domains. Bu izin olmadan PR yine açılır, ama Claude sonucu Night Watch'a bildiremez.</p>
          <div>
            <span className="font-medium">4. API tetikleyicisi ekle</span>
            <p className="mt-1 text-muted-foreground">Tetikleyici olarak “API” seç ve anahtar üret. Anahtar yalnızca bir kez gösterilir. Adresi ve anahtarı aşağıya yapıştır.</p>
          </div>
          <Field label="Tetikleme adresi" htmlFor="claude-url">
            <Input id="claude-url" className="font-mono text-[12px]" placeholder="https://api.anthropic.com/v1/claude_code/routines/trig_…/fire" value={fireUrl} onChange={(e) => setFireUrl(e.target.value)} />
          </Field>
          <Field label="Anahtar" htmlFor="claude-token">
            <Input id="claude-token" type="password" autoComplete="off" className="font-mono text-[12px]" placeholder={claude.linked ? 'Kayıtlı; değiştirmek için yenisini yaz' : 'sk-ant-oat01-…'} value={token} onChange={(e) => setToken(e.target.value)} />
            <span className="text-xs text-muted-foreground">Şifreli saklanır ve kaydedildikten sonra bir daha gösterilmez.</span>
          </Field>
          <div className="flex flex-wrap items-center gap-2">
            <Button
              size="sm"
              disabled={busy}
              onClick={async () => {
                if (await act(() => onSave(fireUrl.trim(), token.trim()))) setToken('');
              }}
            >
              Kaydet
            </Button>
            {claude.linked ? (
              <Button variant="outline" size="sm" disabled={busy} onClick={() => act(onTest)}>
                <Play /> Deneme gönder
              </Button>
            ) : null}
            {claude.linked ? (
              <Confirm size="sm" confirmText="Emin misin? Kaldır" onConfirm={() => act(onRemove)}>
                Bağlantıyı kaldır
              </Confirm>
            ) : null}
          </div>
          {test && TEST_STATE[test.state] ? (
            <p className="text-muted-foreground">
              {TEST_STATE[test.state]}
              {test.state === 'tetiklenemedi' && test.error ? `: ${test.error}` : ''}
              {test.at ? ` (${fmtTime(test.at)})` : ''}
            </p>
          ) : null}
        </div>
      ) : null}
    </div>
  );
}

export function SettingsPanel({ meta, busy, toast, onSaveClaude, onTestClaude, onRemoveClaude, onRegenIngest, onSaveProfile, onSaveProject, onSaveCreds, onClearCreds, onRun, onMail, onLogout, onDeleteProject }) {
  const p = meta.project || {};
  const admin = !!meta.admin;
  const creds = meta.credentials || { values: {}, set: {} };
  const [form, setForm] = useState({ name: '', notifyEmail: '', defaultOwner: '', members: '', alertMode: 'hepsi', fixMode: 'otomatik' });
  useEffect(() => {
    setForm({ name: p.name || '', notifyEmail: p.notifyEmail || '', defaultOwner: p.defaultOwner || '', members: p.members || '', alertMode: p.alertMode || 'hepsi', fixMode: p.fixMode || 'otomatik' });
  }, [p.name, p.notifyEmail, p.defaultOwner, p.members, p.alertMode, p.fixMode]);
  const bind = (k) => ({ value: form[k], onChange: (e) => setForm({ ...form, [k]: e.target.value }) });
  return (
    <div className="flex max-w-3xl flex-col gap-7">
      <ProfileSection me={meta.me} onSave={onSaveProfile} />
      {admin ? (
        <Section title="Proje">
          <form
            className="grid gap-3 rounded-lg border bg-card p-4 md:grid-cols-2"
            onSubmit={(e) => {
              e.preventDefault();
              onSaveProject(form);
            }}
          >
            <Field label="Proje adı" htmlFor="set-name">
              <Input id="set-name" {...bind('name')} />
            </Field>
            <Field label="Bildirim adresi" htmlFor="set-email">
              <Input id="set-email" inputMode="email" placeholder="ornek@alan.com" {...bind('notifyEmail')} />
            </Field>
            <Field label="Otomatik açılan kayıtlar kime atansın?" htmlFor="set-owner">
              <OwnerPick id="set-owner" value={form.defaultOwner} onChange={(v) => setForm({ ...form, defaultOwner: v })} />
            </Field>
            <Field label="Üyeler (e-posta, virgülle)" htmlFor="set-members">
              <Input id="set-members" placeholder="Bu projede birlikte çalışacağın kişiler" {...bind('members')} />
              <span className="text-xs text-muted-foreground">Yeni eklediğin kişilere kaydedince davet maili gider.</span>
            </Field>
            <Field label="Anında mail" htmlFor="set-alert" className="md:col-span-2">
              <Pick id="set-alert" className="sm:max-w-sm" value={form.alertMode} onChange={(v) => setForm({ ...form, alertMode: v })} options={ALERT_MODES} />
              <span className="text-xs text-muted-foreground">Backend'inden gelen hatalar ve sık kontrollerin bulduğu sorunlar için. Günde en fazla 20 anında mail gider.</span>
            </Field>
            <Field label="Claude ile düzeltme" htmlFor="set-fix" className="md:col-span-2">
              <Pick id="set-fix" className="sm:max-w-sm" value={form.fixMode} onChange={(v) => setForm({ ...form, fixMode: v })} options={FIX_MODES} />
              <span className="text-xs text-muted-foreground">Üyeler aşağıdaki “Claude'u bağla” kartından kendi Claude'unu bağlar. Kayıt başına en fazla 2 otomatik deneme, günde en fazla 10.</span>
            </Field>
            <div className="flex flex-wrap items-center gap-3 md:col-span-2">
              <Button type="submit">Kaydet</Button>
              <span className="text-[13px] text-muted-foreground">
                Günlük özet ve hatırlatmalar her sabah 08:00 civarında bildirim adresine gider.
                {meta.mailConfigured ? '' : ' Mail gönderimi için RESEND_API_KEY tanımlı değil.'}
              </span>
            </div>
          </form>
        </Section>
      ) : null}

      <Section title="Bağlı servisler">
        {admin ? (
          <p className="text-[13px] text-muted-foreground">
            Bir servisi bağlamak için “Bağla”ya bas; açılan bölümde adım adım rehber ve gidilecek sayfaların bağlantıları var. Token'lar veritabanında şifreli saklanır ve kaydedildikten sonra bir daha
            gösterilmez.
          </p>
        ) : null}
        {admin ? <IngestCard url={meta.ingestUrl} onRegen={onRegenIngest} toast={toast} /> : null}
        <ClaudeCard claude={meta.claude} onSave={onSaveClaude} onTest={onTestClaude} onRemove={onRemoveClaude} toast={toast} />
        {(meta.services || []).map((s) => (
          <ServiceCard key={s.key} s={s} admin={admin} creds={creds} onSave={onSaveCreds} onClear={() => onClearCreds(s.key)} />
        ))}
      </Section>

      <div className="flex flex-wrap gap-2">
        <Button variant="outline" disabled={busy} onClick={onRun}>
          {busy ? <RotateCcw className="animate-spin" /> : <Play />} Şimdi kontrol et
        </Button>
        <Button variant="outline" disabled={busy} onClick={onMail}>
          <Mail /> Özet mailini şimdi gönder
        </Button>
        <Button variant="ghost" onClick={onLogout}>
          <LogOut /> Çıkış yap
        </Button>
        {admin ? (
          <Confirm confirmText="Emin misin? Tüm kayıtlarıyla sil" onConfirm={onDeleteProject}>
            <Trash2 /> Projeyi sil
          </Confirm>
        ) : null}
      </div>
    </div>
  );
}
