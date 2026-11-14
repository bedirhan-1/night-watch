'use client';

import { useEffect, useRef, useState } from 'react';
import { Check, Copy, ExternalLink, Plus, X } from 'lucide-react';
import { cn } from '@/lib/cn';
import { Button } from '@/components/ui/button';
import { Input, Textarea } from '@/components/ui/input';
import { Dialog, DialogContent } from '@/components/ui/dialog';
import { Pick, Field, OwnerPick, FixBadge, useMe, usePeople, ownerLabel } from './bits';
import { ST, PR, CAT, ENV, DST, LOG_KINDS, today, day, fmtTime, toLocalInput, safeUrl, parseChecklist, serializeChecklist, recordText } from '@/lib/board';

function useForm(initial) {
  const [form, setForm] = useState(initial);
  const bind = (k) => ({ value: form[k] || '', onChange: (e) => setForm((f) => ({ ...f, [k]: e.target.value })) });
  const pick = (k) => ({ value: form[k] || '', onChange: (v) => setForm((f) => ({ ...f, [k]: v })) });
  return [form, bind, pick];
}

// Madde listesi düzenleyici. Enter yeni madde açar, boş maddede Backspace onu siler,
// çok satırlı metin yapıştırılırsa her satır ayrı madde olur.
function Checklist({ value, onChange }) {
  const [items, setItems] = useState(() => {
    const parsed = parseChecklist(value);
    return parsed.length ? parsed : [{ done: false, text: '' }];
  });
  const refs = useRef([]);
  const focusAt = useRef(-1);
  useEffect(() => {
    if (focusAt.current >= 0 && refs.current[focusAt.current]) refs.current[focusAt.current].focus();
    focusAt.current = -1;
  });
  const commit = (next, focus = -1) => {
    const list = next.length ? next : [{ done: false, text: '' }];
    focusAt.current = focus;
    setItems(list);
    onChange(serializeChecklist(list));
  };
  const setAt = (i, patch) => commit(items.map((it, j) => (j === i ? { ...it, ...patch } : it)));
  const insertAfter = (i) => commit([...items.slice(0, i + 1), { done: false, text: '' }, ...items.slice(i + 1)], i + 1);
  const removeAt = (i) => commit(items.filter((_, j) => j !== i), Math.max(0, i - 1));
  const done = items.filter((i) => i.done && i.text.trim()).length;
  const total = items.filter((i) => i.text.trim()).length;
  return (
    <div className="rounded-md border border-input bg-chrome">
      {total ? (
        <div className="flex items-center gap-2.5 border-b px-3 py-2">
          <div className="h-1.5 flex-1 overflow-hidden rounded-full bg-muted">
            <div className="h-full rounded-full bg-primary transition-[width]" style={{ width: `${Math.round((done / total) * 100)}%` }} />
          </div>
          <span className="text-xs tabular-nums text-muted-foreground">
            {done}/{total}
          </span>
        </div>
      ) : null}
      <ul className="flex flex-col py-1">
        {items.map((it, i) => (
          <li key={i} className="group flex items-center gap-2 px-2.5 py-0.5">
            <button
              type="button"
              aria-label={it.done ? 'Tamamlanmadı olarak işaretle' : 'Tamamlandı olarak işaretle'}
              aria-pressed={it.done}
              onClick={() => setAt(i, { done: !it.done })}
              className={cn(
                'flex size-[18px] shrink-0 items-center justify-center rounded border outline-none focus-visible:ring-2 focus-visible:ring-ring',
                it.done ? 'border-primary bg-primary text-primary-foreground' : 'border-input hover:border-ring',
              )}
            >
              {it.done ? <Check className="size-3" /> : null}
            </button>
            <input
              ref={(el) => (refs.current[i] = el)}
              value={it.text}
              aria-label={`Madde ${i + 1}`}
              placeholder={i === 0 ? 'İlk adımı yaz, Enter ile yenisini ekle' : 'Madde'}
              onChange={(e) => setAt(i, { text: e.target.value })}
              onKeyDown={(e) => {
                if (e.key === 'Enter') {
                  e.preventDefault();
                  if (it.text.trim()) insertAfter(i);
                } else if (e.key === 'Backspace' && !it.text && items.length > 1) {
                  e.preventDefault();
                  removeAt(i);
                }
              }}
              onPaste={(e) => {
                const lines = e.clipboardData.getData('text').split('\n').map((l) => l.trim()).filter(Boolean);
                if (lines.length < 2) return;
                e.preventDefault();
                const added = parseChecklist(lines.join('\n'));
                const head = it.text.trim() ? [it] : [];
                commit([...items.slice(0, i), ...head, ...added, ...items.slice(i + 1)]);
              }}
              className={cn('h-8 min-w-0 flex-1 bg-transparent text-sm outline-none placeholder:text-muted-foreground/60', it.done && 'text-muted-foreground line-through')}
            />
            {items.length > 1 || it.text ? (
              <button
                type="button"
                aria-label="Maddeyi sil"
                onClick={() => removeAt(i)}
                className="rounded p-1 text-muted-foreground opacity-60 outline-none hover:bg-muted hover:text-foreground hover:opacity-100 focus-visible:opacity-100 focus-visible:ring-2 focus-visible:ring-ring"
              >
                <X className="size-3.5" />
              </button>
            ) : null}
          </li>
        ))}
      </ul>
      <button
        type="button"
        onClick={() => insertAfter(items.length - 1)}
        className="flex w-full items-center gap-1.5 border-t px-3 py-2 text-left text-[13px] text-muted-foreground outline-none hover:bg-muted hover:text-foreground focus-visible:ring-2 focus-visible:ring-ring"
      >
        <Plus className="size-3.5" /> Madde ekle
      </button>
    </div>
  );
}

// Panoya kopyalar ve düğmede kısa bir onay gösterir.
function CopyButton({ text, label, done = 'Kopyalandı', className, variant = 'outline', size = 'sm' }) {
  const [state, setState] = useState('');
  async function copy() {
    try {
      await navigator.clipboard.writeText(typeof text === 'function' ? text() : text);
      setState('ok');
    } catch {
      setState('fail');
    }
    setTimeout(() => setState(''), 1800);
  }
  return (
    <Button variant={variant} size={size} className={className} onClick={copy} aria-live="polite">
      {state === 'ok' ? <Check /> : <Copy />}
      {state === 'ok' ? done : state === 'fail' ? 'Kopyalanamadı' : label}
    </Button>
  );
}

function Footer({ id, onDelete, onClose }) {
  const [sure, setSure] = useState(false);
  return (
    <div className="mt-1 flex flex-wrap items-center justify-between gap-2 border-t pt-4 sm:col-span-2">
      <div>
        {id ? (
          <Button variant="destructive" onClick={() => (sure ? onDelete(id) : setSure(true))}>
            {sure ? 'Emin misin? Kalıcı olarak sil' : 'Sil'}
          </Button>
        ) : null}
      </div>
      <div className="flex gap-2">
        <Button variant="ghost" onClick={onClose}>
          Vazgeç
        </Button>
        <Button type="submit">Kaydet</Button>
      </div>
    </div>
  );
}

// Kayıttaki Claude bölümü: son çalışmanın durumu, bağlantılar ve elle tetikleme.
// onFix kayıt kimliğiyle çağrılır; başarılıysa { sessionUrl }, değilse null döner.
function ClaudeSection({ item, onFix }) {
  const [fix, setFix] = useState(item.fix || null);
  const [busy, setBusy] = useState(false);
  const running = !!fix && fix.state === 'calisiyor';
  const pr = fix ? safeUrl(fix.prUrl) : '';
  const session = fix ? safeUrl(fix.sessionUrl) : '';
  const note = fix ? fix.summary || fix.error : '';
  async function start() {
    setBusy(true);
    const r = await onFix(item.id);
    setBusy(false);
    if (r) setFix({ state: 'calisiyor', sessionUrl: r.sessionUrl || '', prUrl: '', summary: '', error: '' });
  }
  const linkCls = 'inline-flex items-center gap-1 text-[13px] text-link hover:underline';
  return (
    <div className="flex flex-col gap-2 rounded-md border bg-chrome/60 px-3 py-2.5 sm:col-span-2">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <span className="flex flex-wrap items-center gap-2 text-sm font-medium">
          Claude
          <FixBadge fix={fix} />
          {!fix ? <span className="text-[13px] font-normal text-muted-foreground">Bu kayıt Claude'a gönderilmedi.</span> : null}
        </span>
        <Button variant="outline" size="sm" disabled={busy || running} onClick={start}>
          {busy ? 'Gönderiliyor…' : fix && !running ? 'Yeniden düzelttir' : "Claude'a düzelttir"}
        </Button>
      </div>
      {pr || session ? (
        <div className="flex flex-wrap gap-x-4 gap-y-1">
          {pr ? (
            <a href={pr} target="_blank" rel="noopener noreferrer" className={linkCls}>
              PR'ı aç <ExternalLink className="size-3.5" />
            </a>
          ) : null}
          {session ? (
            <a href={session} target="_blank" rel="noopener noreferrer" className={linkCls}>
              Oturumu aç <ExternalLink className="size-3.5" />
            </a>
          ) : null}
        </div>
      ) : null}
      {note ? <p className="whitespace-pre-wrap break-words text-[13px] text-muted-foreground">{note}</p> : null}
      {fix && fix.state === 'sonuc_yok' ? <p className="text-[13px] text-muted-foreground">Claude sonucu bildirmedi. Oturumu açıp bak; bulut ortamında Night Watch alan adına izin verilmemiş olabilir.</p> : null}
    </div>
  );
}

const grid = 'grid gap-x-3 gap-y-3.5 sm:grid-cols-2';
const full = 'sm:col-span-2';

function RecordForm({ item, areas, onSave, onDelete, onClose, onFix }) {
  const me = useMe();
  const people = usePeople();
  const [form, bind, pick] = useForm(
    item || { title: '', category: 'gorev', area: '', owner: me ? me.email : '', status: 'acik', priority: 'orta', env: 'production', sourceUrl: '', createdAt: today(), dueDate: '', errorMessage: '', expectedFix: '', nextAction: '', resolvedAt: '' },
  );
  const [error, setError] = useState('');
  const url = safeUrl(form.sourceUrl);
  function submit(e) {
    e.preventDefault();
    if (!String(form.title || '').trim()) return setError('Başlık gerekli.');
    const d = {};
    ['title', 'category', 'status', 'priority', 'env', 'owner', 'area', 'sourceUrl', 'errorMessage', 'expectedFix', 'nextAction', 'dueDate'].forEach((k) => (d[k] = String(form[k] || '').trim()));
    d.expectedFix = serializeChecklist(parseChecklist(d.expectedFix));
    d.createdAt = day(form.createdAt) || today();
    d.resolvedAt = d.status === 'cozuldu' ? day(form.resolvedAt) || today() : '';
    onSave(d, item && item.id);
  }
  // Formdaki güncel değerlerle (kaydedilmemiş düzenlemeler dahil) metin üretir.
  const details = () => recordText({ ...item, ...form }, (o) => ownerLabel(people, o));
  return (
    <form className={grid} onSubmit={submit} noValidate>
      {item ? (
        <div className={`${full} flex flex-wrap items-center justify-between gap-2 rounded-md border bg-chrome/60 px-3 py-2`}>
          <span className="text-[13px] text-muted-foreground">Başlık, hata mesajı, ortam ve tüm alanlar tek metin olarak kopyalanır.</span>
          <CopyButton text={details} label="Tüm ayrıntıları kopyala" />
        </div>
      ) : null}
      {item && onFix ? <ClaudeSection item={item} onFix={onFix} /> : null}
      <Field label="Başlık" htmlFor="rec-title" className={full}>
        <Input id="rec-title" placeholder="Örn. Ödeme sayfasındaki 500 hatasını düzelt" autoFocus={!item} {...bind('title')} />
        {error ? <span className="text-xs text-crit">{error}</span> : null}
      </Field>
      <Field label="Kategori" htmlFor="rec-category">
        <Pick id="rec-category" options={CAT} {...pick('category')} />
      </Field>
      <Field label="Durum" htmlFor="rec-status">
        <Pick id="rec-status" options={ST} {...pick('status')} />
      </Field>
      <Field label="Öncelik" htmlFor="rec-priority">
        <Pick id="rec-priority" options={PR} {...pick('priority')} />
      </Field>
      <Field label="Ortam" htmlFor="rec-env">
        <Pick id="rec-env" options={ENV} placeholder="Belirtilmemiş" {...pick('env')} />
      </Field>
      <Field label="Sorumlu" htmlFor="rec-owner">
        <OwnerPick id="rec-owner" {...pick('owner')} />
      </Field>
      <Field label="Proje alanı" htmlFor="rec-area">
        <Input id="rec-area" list="dl-areas" placeholder="Web, Mobil iOS…" {...bind('area')} />
      </Field>
      <Field label="Kaynak bağlantısı" htmlFor="rec-url" className={full}>
        <Input id="rec-url" type="url" placeholder="https://…" {...bind('sourceUrl')} />
        {url ? (
          <a href={url} target="_blank" rel="noopener noreferrer" className="inline-flex w-max items-center gap-1 text-[13px] text-link hover:underline">
            Kaynağı aç <ExternalLink className="size-3.5" />
          </a>
        ) : null}
      </Field>
      <Field label="Hata mesajı" htmlFor="rec-error" className={full}>
        <Textarea id="rec-error" className="min-h-40 font-mono text-[13px]" {...bind('errorMessage')} />
        {form.errorMessage ? <CopyButton text={() => form.errorMessage} label="Hata mesajını kopyala" variant="ghost" className="w-max px-2 text-muted-foreground" /> : null}
      </Field>
      <Field label="Beklenen çözüm: yapılacaklar" className={full}>
        <Checklist {...pick('expectedFix')} />
      </Field>
      <Field label="Sonraki aksiyon" htmlFor="rec-next" className={full}>
        <Input id="rec-next" {...bind('nextAction')} />
      </Field>
      <Field label="Oluşturulma tarihi" htmlFor="rec-created">
        <Input id="rec-created" type="date" value={day(form.createdAt)} onChange={bind('createdAt').onChange} />
      </Field>
      <Field label="Hedef tarih" htmlFor="rec-due">
        <Input id="rec-due" type="date" {...bind('dueDate')} />
      </Field>
      <Field label="Çözülme tarihi" htmlFor="rec-resolved">
        <Input id="rec-resolved" type="date" value={day(form.resolvedAt)} onChange={bind('resolvedAt').onChange} />
      </Field>
      <Field label="Son güncelleme" htmlFor="rec-updated">
        <Input id="rec-updated" disabled value={item && item.updatedAt ? fmtTime(item.updatedAt) : '—'} readOnly />
      </Field>
      <datalist id="dl-areas">
        {Array.from(new Set([...areas, 'Web', 'Mobil iOS', 'Backend / API', 'Altyapı / AWS'])).map((o) => (
          <option key={o} value={o} />
        ))}
      </datalist>
      <Footer id={item && item.id} onDelete={onDelete} onClose={onClose} />
    </form>
  );
}

function DecisionForm({ item, onSave, onDelete, onClose }) {
  const me = useMe();
  const [form, bind, pick] = useForm(item || { title: '', note: '', status: 'bekliyor', owner: me ? me.email : '', decidedAt: '', createdAt: today() });
  const [error, setError] = useState('');
  function submit(e) {
    e.preventDefault();
    if (!String(form.title || '').trim()) return setError('Madde başlığı gerekli.');
    const d = { title: form.title.trim(), note: String(form.note || '').trim(), status: form.status, owner: String(form.owner || '').trim(), decidedAt: form.decidedAt || '', createdAt: day(form.createdAt) || today() };
    if (d.status !== 'bekliyor' && !d.decidedAt) d.decidedAt = today();
    onSave(d, item && item.id);
  }
  return (
    <form className={grid} onSubmit={submit} noValidate>
      <Field label="Madde" htmlFor="dec-title" className={full}>
        <Input id="dec-title" placeholder="Örn. Erişim anahtarları 90 günde bir döndürülecek" autoFocus={!item} {...bind('title')} />
        {error ? <span className="text-xs text-crit">{error}</span> : null}
      </Field>
      <Field label="Karar ve gerekçe" htmlFor="dec-note" className={full}>
        <Textarea id="dec-note" {...bind('note')} />
      </Field>
      <Field label="Durum" htmlFor="dec-status">
        <Pick id="dec-status" options={DST} {...pick('status')} />
      </Field>
      <Field label="Sorumlu" htmlFor="dec-owner">
        <OwnerPick id="dec-owner" {...pick('owner')} />
      </Field>
      <Field label="Karar tarihi" htmlFor="dec-decided">
        <Input id="dec-decided" type="date" {...bind('decidedAt')} />
      </Field>
      <Field label="Eklenme tarihi" htmlFor="dec-created">
        <Input id="dec-created" type="date" value={day(form.createdAt)} onChange={bind('createdAt').onChange} />
      </Field>
      <Footer id={item && item.id} onDelete={onDelete} onClose={onClose} />
    </form>
  );
}

function ReminderForm({ item, onSave, onDelete, onClose }) {
  const [form, bind, pick] = useForm(item ? { ...item, done: item.done ? '1' : '0' } : { title: '', note: '', dueDate: today(), done: '0' });
  const [error, setError] = useState('');
  function submit(e) {
    e.preventDefault();
    if (!String(form.title || '').trim()) return setError('Başlık gerekli.');
    onSave({ title: form.title.trim(), note: String(form.note || '').trim(), dueDate: form.dueDate || '', done: form.done === '1' }, item && item.id);
  }
  return (
    <form className={grid} onSubmit={submit} noValidate>
      <Field label="Yapılacak" htmlFor="rem-title" className={full}>
        <Input id="rem-title" placeholder="Örn. Apple geliştirici sertifikasını yenile" autoFocus={!item} {...bind('title')} />
        {error ? <span className="text-xs text-crit">{error}</span> : null}
      </Field>
      <Field label="Not" htmlFor="rem-note" className={full}>
        <Textarea id="rem-note" {...bind('note')} />
      </Field>
      <Field label="Hatırlatma tarihi" htmlFor="rem-due">
        <Input id="rem-due" type="date" {...bind('dueDate')} />
      </Field>
      <Field label="Durum" htmlFor="rem-done">
        <Pick id="rem-done" options={[['0', 'Bekliyor'], ['1', 'Tamamlandı']]} {...pick('done')} />
      </Field>
      <Footer id={item && item.id} onDelete={onDelete} onClose={onClose} />
    </form>
  );
}

function LogForm({ item, onSave, onDelete, onClose }) {
  const [form, bind, pick] = useForm(item ? { ...item, when: toLocalInput(item.loggedAt) } : { title: '', note: '', kind: 'olay', when: toLocalInput() });
  const [error, setError] = useState('');
  function submit(e) {
    e.preventDefault();
    if (!String(form.title || '').trim()) return setError('Ne yaptığını yaz.');
    const d = new Date(form.when);
    onSave({ title: form.title.trim(), note: String(form.note || '').trim(), kind: form.kind || 'olay', loggedAt: (isNaN(d) ? new Date() : d).toISOString() }, item && item.id);
  }
  return (
    <form className={grid} onSubmit={submit} noValidate>
      <Field label="Ne yaptın?" htmlFor="log-title" className={full}>
        <Input id="log-title" maxLength={300} placeholder="Örn. 1.0.2 sürümünü yayınladım" autoFocus={!item} {...bind('title')} />
        {error ? <span className="text-xs text-crit">{error}</span> : null}
      </Field>
      <Field label="Ayrıntı" htmlFor="log-note" className={full}>
        <Textarea id="log-note" placeholder="Neler değişti, nelere dikkat etmek gerekiyor" {...bind('note')} />
      </Field>
      <Field label="Tür" htmlFor="log-kind">
        <Pick id="log-kind" options={LOG_KINDS} {...pick('kind')} />
      </Field>
      <Field label="Tarih ve saat" htmlFor="log-when">
        <Input id="log-when" type="datetime-local" {...bind('when')} />
      </Field>
      <Footer id={item && item.id} onDelete={onDelete} onClose={onClose} />
    </form>
  );
}

const TITLES = {
  records: ['Yeni kayıt', 'Kaydı düzenle'],
  decisions: ['Yeni karar maddesi', 'Karar maddesini düzenle'],
  reminders: ['Yeni hatırlatma', 'Hatırlatmayı düzenle'],
  logs: ['Yeni günlük kaydı', 'Günlük kaydını düzenle'],
};

// dialog: { table: 'records' | 'decisions' | 'reminders', item: düzenlenen satır ya da null }
export function EditDialog({ dialog, areas, onSave, onDelete, onClose, onFix }) {
  const table = dialog ? dialog.table : 'records';
  const item = dialog ? dialog.item : null;
  const common = { item, onClose, onSave: (data, id) => onSave(table, data, id), onDelete: (id) => onDelete(table, id) };
  return (
    <Dialog open={!!dialog} onOpenChange={(o) => !o && onClose()}>
      {dialog ? (
        <DialogContent title={TITLES[table][item ? 1 : 0]} key={table + (item ? item.id : 'new')}>
          {table === 'records' ? <RecordForm areas={areas} onFix={onFix} {...common} /> : null}
          {table === 'decisions' ? <DecisionForm {...common} /> : null}
          {table === 'reminders' ? <ReminderForm {...common} /> : null}
          {table === 'logs' ? <LogForm {...common} /> : null}
        </DialogContent>
      ) : null}
    </Dialog>
  );
}
