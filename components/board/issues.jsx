'use client';

import { useState } from 'react';
import { CalendarDays, Check, ListChecks, Plus, Search, X } from 'lucide-react';
import { Badge } from '@/components/ui/badge';
import { cn } from '@/lib/cn';
import { Button } from '@/components/ui/button';
import { usePeople, ownerLabel, Pick, Empty, Avatar, PriorityBadge, StatusBadge, LateBadge, SourceBadge, QuickMenu, priorityStripe } from './bits';
import { ST, PR, CAT, SORTS, label, uniq, sortRecs, isDone, isLate, fmt, ago, day, today, presetLabel, checklistProgress } from '@/lib/board';

const seg = 'h-10 w-auto min-w-0 flex-1 rounded-none border-0 bg-transparent px-3 font-medium shadow-none sm:flex-none';

export function FilterBar({ records, f, setF, preset, setPreset, sort, setSort }) {
  const set = (k) => (v) => setF({ ...f, [k]: v });
  const people = usePeople();
  const pairs = (key) => uniq(records, key).map((x) => [x, key === 'owner' ? ownerLabel(people, x) : x]);
  return (
    <div className="flex flex-col gap-2.5 xl:flex-row xl:items-center">
      <div className="flex divide-x overflow-hidden rounded-md border bg-chrome shadow-[0_2px_0_rgba(0,0,0,.28)]">
        <Pick className={seg} ariaLabel="Durum" value={f.status} onChange={set('status')} options={ST} placeholder="Tüm durumlar" />
        <Pick className={seg} ariaLabel="Öncelik" value={f.priority} onChange={set('priority')} options={PR} placeholder="Tüm öncelikler" />
        <Pick className={cn(seg, 'hidden sm:flex')} ariaLabel="Sorumlu" value={f.owner} onChange={set('owner')} options={pairs('owner')} placeholder="Tüm sorumlular" />
        <Pick className={cn(seg, 'hidden sm:flex')} ariaLabel="Proje alanı" value={f.area} onChange={set('area')} options={pairs('area')} placeholder="Tüm alanlar" />
      </div>
      <div className="flex divide-x overflow-hidden rounded-md border bg-chrome sm:hidden">
        <Pick className={seg} ariaLabel="Sorumlu" value={f.owner} onChange={set('owner')} options={pairs('owner')} placeholder="Tüm sorumlular" />
        <Pick className={seg} ariaLabel="Proje alanı" value={f.area} onChange={set('area')} options={pairs('area')} placeholder="Tüm alanlar" />
      </div>
      <div className="flex min-w-0 flex-1 gap-2.5">
        <label className="flex h-10 min-w-0 flex-1 items-center gap-2 rounded-md border bg-chrome px-3 focus-within:border-ring focus-within:ring-2 focus-within:ring-ring/40">
          <Search className="size-4 shrink-0 text-muted-foreground" />
          {preset !== 'all' ? (
            <span className="inline-flex shrink-0 items-center gap-1 rounded border bg-muted/60 py-0.5 pl-2 pr-1 text-[13px]">
              <span className="text-muted-foreground">görünüm</span>
              <span className="text-link">{presetLabel(preset).toLocaleLowerCase('tr')}</span>
              <button type="button" aria-label="Görünüm filtresini kaldır" onClick={() => setPreset('all')} className="rounded p-0.5 text-muted-foreground hover:bg-muted hover:text-foreground">
                <X className="size-3" />
              </button>
            </span>
          ) : null}
          <input
            id="filter-q"
            type="search"
            value={f.q}
            onChange={(e) => set('q')(e.target.value)}
            placeholder="Başlık, hata mesajı ya da aksiyonda ara"
            aria-label="Ara"
            className="h-full min-w-0 flex-1 bg-transparent text-sm outline-none placeholder:text-muted-foreground/70"
          />
        </label>
        <div className="shrink-0">
          <Pick className="h-10 w-auto gap-2 font-medium shadow-[0_2px_0_rgba(0,0,0,.28)]" ariaLabel="Sıralama" value={sort} onChange={setSort} options={SORTS} />
        </div>
      </div>
    </div>
  );
}

// Her görünümün üstünde: kritik ve hedef tarihi geçmiş açık işler.
export function Attention({ records, onOpen }) {
  const items = records
    .filter((r) => !isDone(r) && (r.priority === 'kritik' || isLate(r)))
    .sort((a, b) => isLate(b) - isLate(a));
  if (!items.length) return null;
  const crit = items.filter((r) => r.priority === 'kritik').length;
  const late = items.filter(isLate).length;
  return (
    <section aria-label="Kritik ve geciken işler" className="rounded-lg border border-l-[3px] border-l-crit bg-card px-4 py-3">
      <h2 className="flex flex-wrap items-baseline gap-x-3 text-sm font-semibold">
        Önce bunlar
        <span className="font-medium text-crit">{crit} kritik</span>
        <span className="font-medium text-high">{late} geciken</span>
      </h2>
      <div className="no-scrollbar -mx-1 mt-2.5 flex gap-2 overflow-x-auto px-1 pb-0.5">
        {items.map((r) => (
          <button
            key={r.id}
            type="button"
            onClick={() => onOpen(r)}
            className="flex w-60 shrink-0 flex-col gap-1.5 rounded-md border bg-chrome px-3 py-2 text-left outline-none hover:border-primary focus-visible:ring-2 focus-visible:ring-ring"
          >
            <span className="truncate text-[13px] font-medium">{r.title}</span>
            <span className="flex flex-wrap gap-1.5">
              <LateBadge record={r} />
              {r.priority === 'kritik' ? <PriorityBadge priority="kritik" /> : null}
            </span>
          </button>
        ))}
      </div>
    </section>
  );
}

const COLS = 'lg:grid lg:grid-cols-[minmax(0,1fr)_96px_72px_104px_132px_150px_56px] lg:items-center lg:gap-3';
const th = 'border-l pl-3 first:border-l-0 first:pl-0';

// Varsayılan görünüm: kayıt tablosu. Öncelik ve durum satırdan değiştirilebilir.
export function IssueTable({ list, sort, onOpen, onPatch }) {
  const rows = sortRecs(list, sort);
  if (!rows.length) return <Empty>Bu görünüme uyan kayıt yok.</Empty>;
  return (
    <div className="overflow-hidden rounded-lg border bg-card">
      <div className={cn('hidden border-b bg-chrome/60 px-4 py-2.5 text-[13px] font-medium text-muted-foreground', COLS)}>
        <span>Kayıt</span>
        <span className={th}>Güncellendi</span>
        <span className={th}>Yaş</span>
        <span className={th}>Hedef</span>
        <span className={th}>Öncelik</span>
        <span className={th}>Durum</span>
        <span className={cn(th, 'text-right')}>Kişi</span>
      </div>
      <ul className="divide-y">
        {rows.map((r) => (
          <li key={r.id} className={cn('px-4 py-3 transition-colors hover:bg-muted/40', COLS, isDone(r) && 'opacity-70')}>
            <button type="button" onClick={() => onOpen(r)} className="block w-full min-w-0 rounded text-left outline-none focus-visible:ring-2 focus-visible:ring-ring">
              <span className="flex flex-wrap items-center gap-x-2 gap-y-1 text-[13px] font-semibold">
                {label(CAT, r.category)}
                <LateBadge record={r} />
                <SourceBadge record={r} />
              </span>
              <span className="mt-1 flex items-start gap-2">
                <span className={cn('mt-[3px] h-4 w-1 shrink-0 rounded-full', priorityStripe(r))} />
                <span className="min-w-0 break-words text-[15px] leading-snug">{r.title}</span>
              </span>
              <span className="mt-1 block truncate text-[13px] text-muted-foreground">
                {[r.area, r.env, r.nextAction && !isDone(r) ? 'Sonraki: ' + r.nextAction : ''].filter(Boolean).join('  ·  ') || 'Sonraki aksiyon yazılmamış'}
              </span>
            </button>
            <span className="hidden text-sm tabular-nums text-muted-foreground lg:block" title={r.updatedAt}>
              {ago(r.updatedAt)}
            </span>
            <span className="hidden text-sm tabular-nums text-muted-foreground lg:block">{ago(day(r.createdAt))}</span>
            <span className={cn('hidden text-sm tabular-nums lg:block', isLate(r) ? 'font-medium text-crit' : 'text-muted-foreground')}>
              {isDone(r) ? (r.resolvedAt ? fmt(r.resolvedAt) : '—') : r.dueDate ? fmt(r.dueDate) : '—'}
            </span>
            <div className="mt-2.5 flex flex-wrap items-center gap-2 lg:contents">
              <span className="lg:block">
                <QuickMenu kind="priority" value={r.priority} onChange={(v) => onPatch(r, { priority: v })} />
              </span>
              <span className="lg:block">
                <QuickMenu kind="status" value={r.status} onChange={(v) => onPatch(r, { status: v })} />
              </span>
              <span className="ml-auto flex items-center gap-2 text-xs text-muted-foreground lg:ml-0 lg:justify-end">
                <Progress record={r} />
                <span className="lg:hidden">{ago(r.updatedAt)}</span>
                <Avatar name={r.owner} />
              </span>
            </div>
          </li>
        ))}
      </ul>
      <div className="border-t bg-chrome/40 px-4 py-2 text-right text-[13px] tabular-nums text-muted-foreground">{rows.length} kayıt</div>
    </div>
  );
}

// Madde listesindeki ilerleme, örn. 2/5.
function Progress({ record }) {
  const p = checklistProgress(record.expectedFix);
  if (!p.total) return null;
  return (
    <span className={cn('inline-flex items-center gap-1 tabular-nums', p.done === p.total && 'text-done')} title="Tamamlanan madde">
      <ListChecks className="size-3.5" />
      {p.done}/{p.total}
    </span>
  );
}

function Card({ r, onOpen, onPatch }) {
  const [dragging, setDragging] = useState(false);
  const done = isDone(r);
  return (
    <div
      role="button"
      tabIndex={0}
      draggable
      onDragStart={(e) => {
        e.dataTransfer.setData('text/plain', r.id);
        e.dataTransfer.effectAllowed = 'move';
        setDragging(true);
      }}
      onDragEnd={() => setDragging(false)}
      onClick={() => onOpen(r)}
      onKeyDown={(e) => {
        if (e.target === e.currentTarget && (e.key === 'Enter' || e.key === ' ')) {
          e.preventDefault();
          onOpen(r);
        }
      }}
      className={cn(
        'group relative flex cursor-grab flex-col gap-2 overflow-hidden rounded-md border bg-chrome py-2.5 pl-4 pr-3 outline-none hover:border-primary focus-visible:ring-2 focus-visible:ring-ring active:cursor-grabbing',
        isLate(r) && 'border-crit/70',
        done && 'opacity-70',
        dragging && 'opacity-40',
      )}
    >
      <span className={cn('absolute inset-y-0 left-0 w-1', priorityStripe(r))} />
      <span className="flex items-start gap-2">
        <button
          type="button"
          aria-label={done ? 'Yeniden aç' : 'Çözüldü olarak işaretle'}
          title={done ? 'Yeniden aç' : 'Çözüldü olarak işaretle'}
          onClick={(e) => {
            e.stopPropagation();
            onPatch(r, { status: done ? 'acik' : 'cozuldu' });
          }}
          className={cn(
            'mt-0.5 flex size-[18px] shrink-0 items-center justify-center rounded-full border outline-none focus-visible:ring-2 focus-visible:ring-ring',
            done ? 'border-done bg-done/20 text-done' : 'border-input text-transparent hover:border-done hover:text-done',
          )}
        >
          <Check className="size-3" />
        </button>
        <span className={cn('min-w-0 flex-1 break-words text-sm font-medium leading-snug', done && 'line-through decoration-muted-foreground/60')}>{r.title}</span>
      </span>
      {isLate(r) || r.source !== 'manual' || r.category !== 'gorev' ? (
        <span className="flex flex-wrap gap-1.5">
          <LateBadge record={r} />
          <SourceBadge record={r} />
          {r.category !== 'gorev' ? <Badge>{label(CAT, r.category)}</Badge> : null}
        </span>
      ) : null}
      {r.nextAction && !done ? (
        <span className="break-words text-[13px] text-muted-foreground">
          <span className="font-medium text-link">Sonraki:</span> {r.nextAction}
        </span>
      ) : null}
      <span className="flex flex-wrap items-center justify-between gap-2">
        <span className="flex min-w-0 items-center gap-2 text-xs text-muted-foreground">
          <Avatar name={r.owner} className="size-6 text-[10px]" />
          {r.dueDate && !done ? (
            <span className={cn('inline-flex items-center gap-1 tabular-nums', isLate(r) && 'font-medium text-crit')}>
              <CalendarDays className="size-3.5" />
              {fmt(r.dueDate)}
            </span>
          ) : null}
          <Progress record={r} />
        </span>
        <span className="flex items-center gap-1.5">
          <QuickMenu kind="priority" value={r.priority} onChange={(v) => onPatch(r, { priority: v })} />
          <QuickMenu kind="status" value={r.status} onChange={(v) => onPatch(r, { status: v })} />
        </span>
      </span>
    </div>
  );
}

// Sütunun altındaki hızlı ekleme: başlığı yaz, Enter'a bas; art arda eklemek için açık kalır.
function QuickAdd({ status, onAdd }) {
  const [open, setOpen] = useState(false);
  const [title, setTitle] = useState('');
  const [busy, setBusy] = useState(false);
  async function submit(e) {
    e.preventDefault();
    const t = title.trim();
    if (!t || busy) return;
    setBusy(true);
    const ok = await onAdd(status, t);
    setBusy(false);
    if (ok) setTitle('');
  }
  if (!open) {
    return (
      <button
        type="button"
        onClick={() => setOpen(true)}
        className="flex items-center gap-1.5 rounded-md px-2 py-1.5 text-left text-[13px] text-muted-foreground outline-none hover:bg-muted hover:text-foreground focus-visible:ring-2 focus-visible:ring-ring"
      >
        <Plus className="size-4" /> Görev ekle
      </button>
    );
  }
  return (
    <form onSubmit={submit} className="flex flex-col gap-2 rounded-md border border-primary/60 bg-chrome p-2">
      <textarea
        autoFocus
        rows={2}
        value={title}
        onChange={(e) => setTitle(e.target.value)}
        onKeyDown={(e) => {
          if (e.key === 'Enter' && !e.shiftKey) submit(e);
          if (e.key === 'Escape') setOpen(false);
        }}
        placeholder="Ne yapılacak?"
        aria-label="Yeni görev başlığı"
        className="w-full resize-none bg-transparent text-sm outline-none placeholder:text-muted-foreground/70"
      />
      <div className="flex items-center justify-between gap-2">
        <span className="text-[11px] text-muted-foreground">Enter ekler, Esc kapatır</span>
        <div className="flex gap-1.5">
          <Button variant="ghost" size="sm" className="h-7" onClick={() => setOpen(false)}>
            Kapat
          </Button>
          <Button type="submit" size="sm" className="h-7" disabled={busy || !title.trim()}>
            Ekle
          </Button>
        </div>
      </div>
    </form>
  );
}

const DONE_LIMIT = 8;

export function KanbanView({ list, sort, onOpen, onPatch, onQuickAdd }) {
  const [over, setOver] = useState('');
  const [allDone, setAllDone] = useState(false);
  return (
    <div className="no-scrollbar -mx-4 grid auto-cols-[min(86%,320px)] grid-flow-col items-start gap-3 overflow-x-auto px-4 pb-2 lg:mx-0 lg:auto-cols-auto lg:grid-flow-row lg:grid-cols-4 lg:overflow-visible lg:px-0">
      {ST.map(([key, text]) => {
        const all = sortRecs(list.filter((r) => r.status === key), key === 'cozuldu' ? 'guncel' : sort);
        const items = key === 'cozuldu' && !allDone ? all.slice(0, DONE_LIMIT) : all;
        return (
          <section
            key={key}
            onDragOver={(e) => {
              e.preventDefault();
              e.dataTransfer.dropEffect = 'move';
              if (over !== key) setOver(key);
            }}
            onDragLeave={(e) => {
              if (!e.currentTarget.contains(e.relatedTarget)) setOver('');
            }}
            onDrop={(e) => {
              e.preventDefault();
              setOver('');
              const id = e.dataTransfer.getData('text/plain');
              const r = list.find((x) => x.id === id);
              if (r && r.status !== key) onPatch(r, { status: key });
            }}
            className={cn('flex min-h-44 flex-col gap-2 rounded-lg border bg-card p-2.5 transition-colors', over === key && 'border-primary bg-accent/25')}
          >
            <h3 className="flex items-center justify-between px-1 text-xs font-semibold uppercase tracking-wider text-muted-foreground">
              {text}
              <span className="rounded-full bg-muted px-2 py-0.5 tabular-nums">{all.length}</span>
            </h3>
            {items.map((r) => (
              <Card key={r.id} r={r} onOpen={onOpen} onPatch={onPatch} />
            ))}
            {all.length > items.length ? (
              <button type="button" onClick={() => setAllDone(true)} className="rounded-md px-2 py-1.5 text-left text-[13px] text-link outline-none hover:bg-muted focus-visible:ring-2 focus-visible:ring-ring">
                {all.length - items.length} kayıt daha göster
              </button>
            ) : null}
            {!all.length && over !== key ? <p className="px-2 py-3 text-center text-[13px] text-muted-foreground/80">Buraya kart sürükle ya da görev ekle</p> : null}
            <QuickAdd status={key} onAdd={onQuickAdd} />
          </section>
        );
      })}
    </div>
  );
}

const EV = {
  open: ['Açıldı', 'bg-primary', 'text-muted-foreground'],
  done: ['Çözüldü', 'bg-done', 'text-done'],
  due: ['Hedef tarih', 'bg-high', 'text-high'],
  late: ['Hedef tarih geçti', 'bg-crit', 'text-crit'],
};

export function TimelineView({ list, onOpen }) {
  const t = today();
  const ev = [];
  list.forEach((r) => {
    if (r.createdAt) ev.push({ d: day(r.createdAt), k: 'open', r });
    if (isDone(r) && r.resolvedAt) ev.push({ d: day(r.resolvedAt), k: 'done', r });
    if (!isDone(r) && r.dueDate) ev.push({ d: r.dueDate, k: r.dueDate < t ? 'late' : 'due', r });
  });
  if (!ev.length) return <Empty>Bu görünüme uyan kayıt yok.</Empty>;
  const groups = {};
  ev.forEach((e) => (groups[e.d] = groups[e.d] || []).push(e));
  return (
    <div className="flex flex-col gap-5">
      {Object.keys(groups)
        .sort()
        .reverse()
        .map((d) => (
          <section key={d}>
            <h3 className={cn('mb-2 text-[13px] font-semibold', d === t ? 'text-link' : 'text-muted-foreground')}>
              {d === t ? 'Bugün · ' : d > t ? 'Yaklaşan · ' : ''}
              {fmt(d, true)}
            </h3>
            <div className="ml-1.5 flex flex-col gap-2 border-l-2 pl-4">
              {groups[d].map((e, i) => (
                <button
                  key={e.r.id + e.k + i}
                  type="button"
                  onClick={() => onOpen(e.r)}
                  className="relative flex flex-col gap-1.5 rounded-md border bg-card px-3 py-2.5 text-left outline-none hover:border-primary focus-visible:ring-2 focus-visible:ring-ring"
                >
                  <span className={cn('absolute -left-[23px] top-3.5 size-2.5 rounded-full ring-4 ring-background', EV[e.k][1])} />
                  <span className={cn('text-[11px] font-semibold uppercase tracking-wider', EV[e.k][2])}>{EV[e.k][0]}</span>
                  <span className="break-words text-sm font-medium">{e.r.title}</span>
                  <span className="flex flex-wrap gap-1.5">
                    <PriorityBadge priority={e.r.priority} />
                    <StatusBadge status={e.r.status} />
                    <SourceBadge record={e.r} />
                  </span>
                </button>
              ))}
            </div>
          </section>
        ))}
    </div>
  );
}
