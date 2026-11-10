'use client';

import { useState } from 'react';
import { ExternalLink } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input, Textarea } from '@/components/ui/input';
import { Dialog, DialogContent } from '@/components/ui/dialog';
import { Pick, Field, OwnerPick, useMe } from './bits';
import { ST, PR, CAT, ENV, DST, today, day, fmtTime, safeUrl } from '@/lib/board';

function useForm(initial) {
  const [form, setForm] = useState(initial);
  const bind = (k) => ({ value: form[k] || '', onChange: (e) => setForm((f) => ({ ...f, [k]: e.target.value })) });
  const pick = (k) => ({ value: form[k] || '', onChange: (v) => setForm((f) => ({ ...f, [k]: v })) });
  return [form, bind, pick];
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

const grid = 'grid gap-x-3 gap-y-3.5 sm:grid-cols-2';
const full = 'sm:col-span-2';

function RecordForm({ item, areas, onSave, onDelete, onClose }) {
  const me = useMe();
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
    d.createdAt = day(form.createdAt) || today();
    d.resolvedAt = d.status === 'cozuldu' ? day(form.resolvedAt) || today() : '';
    onSave(d, item && item.id);
  }
  return (
    <form className={grid} onSubmit={submit} noValidate>
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
        <Textarea id="rec-error" className="font-mono text-[13px]" {...bind('errorMessage')} />
      </Field>
      <Field label="Beklenen çözüm" htmlFor="rec-fix" className={full}>
        <Textarea id="rec-fix" {...bind('expectedFix')} />
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

const TITLES = {
  records: ['Yeni kayıt', 'Kaydı düzenle'],
  decisions: ['Yeni karar maddesi', 'Karar maddesini düzenle'],
  reminders: ['Yeni hatırlatma', 'Hatırlatmayı düzenle'],
};

// dialog: { table: 'records' | 'decisions' | 'reminders', item: düzenlenen satır ya da null }
export function EditDialog({ dialog, areas, onSave, onDelete, onClose }) {
  const table = dialog ? dialog.table : 'records';
  const item = dialog ? dialog.item : null;
  const common = { item, onClose, onSave: (data, id) => onSave(table, data, id), onDelete: (id) => onDelete(table, id) };
  return (
    <Dialog open={!!dialog} onOpenChange={(o) => !o && onClose()}>
      {dialog ? (
        <DialogContent title={TITLES[table][item ? 1 : 0]} key={table + (item ? item.id : 'new')}>
          {table === 'records' ? <RecordForm areas={areas} {...common} /> : null}
          {table === 'decisions' ? <DecisionForm {...common} /> : null}
          {table === 'reminders' ? <ReminderForm {...common} /> : null}
        </DialogContent>
      ) : null}
    </Dialog>
  );
}
