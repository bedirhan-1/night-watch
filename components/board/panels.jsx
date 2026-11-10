'use client';

import { useEffect, useState } from 'react';
import { Check, ChevronLeft, ChevronRight, Copy, ExternalLink, LogOut, Mail, Play, Plus, RotateCcw, Trash2 } from 'lucide-react';
import { GUIDES } from '@/lib/guides';
import { cn } from '@/lib/cn';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Input, Textarea } from '@/components/ui/input';
import { Empty, Field, PriorityBadge, StatusBadge, LateBadge } from './bits';
import { DST, label, fmt, fmtTime, today, weekData, weekText } from '@/lib/board';

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
  return (
    <button type="button" className={cn(rowCls, 'border-l-[3px]', DB[d.status])} onClick={() => onOpen(d)}>
      <span className="break-words text-sm font-medium">{d.title}</span>
      {d.note ? <span className="whitespace-pre-wrap break-words text-[13px] text-muted-foreground">{d.note}</span> : null}
      <span className="flex flex-wrap items-center gap-1.5">
        <Badge variant={DV[d.status]}>{label(DST, d.status)}</Badge>
        {d.owner ? <Badge>{d.owner}</Badge> : null}
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

export function WeekPanel({ projectName, records, decisions, onOpenRecord, onOpenDecision, toast }) {
  const [off, setOff] = useState(0);
  const w = weekData(records, decisions, off);
  async function copy() {
    try {
      await navigator.clipboard.writeText(weekText(projectName || 'Proje', w));
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

// [alan, etiket, tür] — tür: 0 düz metin, 1 gizli tek satır, 2 gizli çok satır
const SVCF = {
  vercel: [['vercelToken', 'Token', 1], ['vercelTeamId', 'Takım ID (isteğe bağlı)', 0], ['vercelProjects', 'Vercel proje adları (virgülle; boşsa hepsi)', 0]],
  github: [['githubToken', 'Token', 1], ['githubRepos', 'Depolar (sahip/depo, virgülle)', 0]],
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
  const value = (f) => (vals[f[0]] != null ? vals[f[0]] : f[2] ? '' : creds.values[f[0]] || '');
  function save() {
    const out = {};
    fields.forEach((f) => {
      const v = String(value(f)).trim();
      if (f[2] && !v) return;
      out[f[0]] = v;
    });
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
            const ph = f[2] && creds.set[f[0]] ? 'Kayıtlı. Değiştirmek için yeni değer gir' : '';
            const common = { id, value: value(f), placeholder: ph, autoComplete: 'off', onChange: (e) => setVals({ ...vals, [f[0]]: e.target.value }) };
            return (
              <Field key={f[0]} label={f[1]} htmlFor={id}>
                {f[2] === 2 ? <Textarea className="font-mono text-[13px]" {...common} /> : <Input type={f[2] ? 'password' : 'text'} {...common} />}
              </Field>
            );
          })}
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

export function SettingsPanel({ meta, busy, onSaveProject, onSaveCreds, onClearCreds, onRun, onMail, onLogout, onDeleteProject }) {
  const p = meta.project || {};
  const admin = !!meta.admin;
  const creds = meta.credentials || { values: {}, set: {} };
  const [form, setForm] = useState({ name: '', notifyEmail: '', defaultOwner: '', members: '' });
  useEffect(() => {
    setForm({ name: p.name || '', notifyEmail: p.notifyEmail || '', defaultOwner: p.defaultOwner || '', members: p.members || '' });
  }, [p.name, p.notifyEmail, p.defaultOwner, p.members]);
  const bind = (k) => ({ value: form[k], onChange: (e) => setForm({ ...form, [k]: e.target.value }) });
  return (
    <div className="flex max-w-3xl flex-col gap-7">
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
            <Field label="Otomatik kayıtların sorumlusu" htmlFor="set-owner">
              <Input id="set-owner" {...bind('defaultOwner')} />
            </Field>
            <Field label="Üyeler (e-posta, virgülle)" htmlFor="set-members">
              <Input id="set-members" placeholder="Bu projeye girebilecek diğer kişiler" {...bind('members')} />
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
