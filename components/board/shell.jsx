'use client';

import { Bell, ScrollText, CalendarDays, Clock, Gavel, Inbox, Kanban, List, LogOut, Folder, Settings, User } from 'lucide-react';
import { cn } from '@/lib/cn';
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuLabel, DropdownMenuSeparator, DropdownMenuTrigger } from '@/components/ui/dropdown-menu';
import { CAT, PRESETS, initials } from '@/lib/board';

export const ISSUE_VIEWS = [
  ['akis', 'Akış', List],
  ['kanban', 'Kanban', Kanban],
  ['zaman', 'Zaman çizelgesi', Clock],
];
export const SECTIONS = [
  ['akis', 'Kayıtlar', Inbox],
  ['hafta', 'Hafta', CalendarDays],
  ['kararlar', 'Kararlar', Gavel],
  ['hatirlatmalar', 'Hatırlatma', Bell],
  ['gunluk', 'Günlük', ScrollText],
  ['ayarlar', 'Ayarlar', Settings],
];
export const VIEW_TITLES = {
  akis: 'Akış',
  kanban: 'Kanban',
  zaman: 'Zaman çizelgesi',
  hafta: 'Haftalık özet',
  kararlar: 'Kararlar',
  hatirlatmalar: 'Hatırlatmalar',
  gunluk: 'Günlük',
  ayarlar: 'Ayarlar',
};
export const isIssueView = (v) => v === 'akis' || v === 'kanban' || v === 'zaman';
const sectionActive = (key, view) => (key === 'akis' ? isIssueView(view) : key === view);

// Night Watch amblemi: mor daire içinde karga başı. Aynı çizim app/icon.svg içinde sekme ikonu olarak durur.
export function Logo({ className }) {
  return (
    <svg viewBox="0 0 120 120" role="img" aria-label="Night Watch" className={cn('size-9 shrink-0 drop-shadow-[0_2px_0_rgba(0,0,0,.3)]', className)}>
      <circle cx="60" cy="60" r="58" className="fill-primary" />
      <path d="M30 98 C26 74 30 50 48 40 C62 32 78 38 82 52 L106 62 L82 70 C78 84 70 94 58 100 L52 88 L46 100 L40 90 Z" className="fill-chrome" />
      <path d="M82 52 L106 62 L82 62 Z" fill="#35324a" />
      <circle cx="66" cy="54" r="5" className="fill-primary-foreground" />
    </svg>
  );
}

function UserMenu({ me, onLogout }) {
  const email = me ? me.email : '';
  const name = me ? me.name : '';
  return (
    <DropdownMenu>
      <DropdownMenuTrigger
        aria-label="Hesap"
        className="inline-flex size-9 items-center justify-center overflow-hidden rounded-lg bg-accent text-xs font-semibold text-accent-foreground outline-none focus-visible:ring-2 focus-visible:ring-ring"
      >
        {me && me.avatar ? <img src={me.avatar} alt="" className="size-full object-cover" /> : initials(name || email) || '?'}
      </DropdownMenuTrigger>
      <DropdownMenuContent side="right" align="end">
        <DropdownMenuLabel>
          {name ? <span className="block text-sm text-foreground">{name}</span> : null}
          {email}
        </DropdownMenuLabel>
        <DropdownMenuSeparator />
        <DropdownMenuItem asChild>
          <a href="#ayarlar">
            <User /> Profil
          </a>
        </DropdownMenuItem>
        <DropdownMenuItem asChild>
          <a href="/">
            <Folder /> Projeler
          </a>
        </DropdownMenuItem>
        <DropdownMenuItem onSelect={onLogout}>
          <LogOut /> Çıkış yap
        </DropdownMenuItem>
      </DropdownMenuContent>
    </DropdownMenu>
  );
}

// Geniş ekranda soldaki ikon şeridi.
export function Rail({ view, dueReminders, me, onLogout }) {
  return (
    <aside className="hidden w-[68px] shrink-0 flex-col items-center border-r bg-chrome py-3 lg:flex">
      <a href="/" aria-label="Projeler" className="mb-3 rounded-lg outline-none focus-visible:ring-2 focus-visible:ring-ring">
        <Logo />
      </a>
      <nav className="flex flex-1 flex-col items-center gap-1" aria-label="Bölümler">
        {SECTIONS.map(([key, text, Icon]) => {
          const on = sectionActive(key, view);
          return (
            <a
              key={key}
              href={'#' + key}
              aria-current={on ? 'page' : undefined}
              className="group flex w-[60px] flex-col items-center gap-1 rounded-md py-1.5 text-[11px] text-muted-foreground outline-none hover:text-foreground focus-visible:ring-2 focus-visible:ring-ring aria-[current=page]:text-foreground"
            >
              <span className={cn('relative flex size-9 items-center justify-center rounded-lg border border-transparent', on ? 'border-primary bg-accent text-accent-foreground' : 'group-hover:bg-muted')}>
                <Icon className="size-[18px]" />
                {key === 'hatirlatmalar' && dueReminders ? <span className="absolute -right-0.5 -top-0.5 size-2.5 rounded-full bg-high ring-2 ring-chrome" /> : null}
              </span>
              {text}
            </a>
          );
        })}
      </nav>
      <UserMenu me={me} onLogout={onLogout} />
    </aside>
  );
}

function SideItem({ active, onClick, href, children, count, tone }) {
  const cls = cn(
    'flex w-full items-center justify-between gap-2 rounded-md border border-transparent px-3 py-1.5 text-left text-sm outline-none focus-visible:ring-2 focus-visible:ring-ring',
    active ? 'border-primary bg-accent text-accent-foreground' : 'text-muted-foreground hover:bg-muted hover:text-foreground',
  );
  const inner = (
    <>
      <span className="truncate">{children}</span>
      {count != null ? <span className={cn('text-xs tabular-nums', tone && count ? tone : active ? 'text-accent-foreground/80' : 'text-muted-foreground/70')}>{count}</span> : null}
    </>
  );
  return href ? (
    <a href={href} className={cls} aria-current={active ? 'page' : undefined}>
      {inner}
    </a>
  ) : (
    <button type="button" onClick={onClick} className={cls} aria-pressed={active}>
      {inner}
    </button>
  );
}

// Kayıtlar bölümünün ikinci kenar çubuğu: görünümler, hazır filtreler, kategoriler.
export function Sidebar({ projectName, view, preset, setPreset, counts }) {
  return (
    <aside className="hidden w-60 shrink-0 flex-col border-r bg-chrome lg:flex">
      <div className="flex h-14 items-center border-b px-4">
        <span className="truncate text-[15px] font-semibold">{projectName || 'Proje'}</span>
      </div>
      <div className="flex min-h-0 flex-1 flex-col gap-1 overflow-y-auto p-2">
        {ISSUE_VIEWS.map(([key, text]) => (
          <SideItem key={key} href={'#' + key} active={view === key}>
            {text}
          </SideItem>
        ))}
        <div className="mx-2 my-2 h-px bg-border" />
        {PRESETS.map(([key, text]) => (
          <SideItem key={key} active={preset === key} onClick={() => setPreset(key)} count={counts[key]} tone={key === 'crit' ? 'text-crit' : key === 'late' ? 'text-high' : undefined}>
            {text}
          </SideItem>
        ))}
        <div className="mx-2 my-2 h-px bg-border" />
        <span className="px-3 pb-1 pt-1 text-xs font-semibold text-foreground">Kategoriler</span>
        {CAT.map(([key, text]) => (
          <SideItem key={key} active={preset === 'cat:' + key} onClick={() => setPreset('cat:' + key)} count={counts['cat:' + key]}>
            {text}
          </SideItem>
        ))}
      </div>
    </aside>
  );
}

// Telefonda kenar çubuğunun yerini tutan yatay şerit.
export function MobileStrip({ view, preset, setPreset, counts }) {
  const chip = (on) =>
    cn(
      'inline-flex h-8 shrink-0 items-center gap-1.5 rounded-full border px-3 text-[13px] outline-none focus-visible:ring-2 focus-visible:ring-ring',
      on ? 'border-primary bg-accent text-accent-foreground' : 'bg-chrome text-muted-foreground',
    );
  return (
    <div className="no-scrollbar -mx-4 flex gap-2 overflow-x-auto px-4 lg:hidden">
      {ISSUE_VIEWS.map(([key, text, Icon]) => (
        <a key={key} href={'#' + key} className={chip(view === key)} aria-current={view === key ? 'page' : undefined}>
          <Icon className="size-3.5" />
          {text}
        </a>
      ))}
      <span className="my-1 w-px shrink-0 bg-border" />
      {PRESETS.map(([key, text]) => (
        <button key={key} type="button" className={chip(preset === key)} aria-pressed={preset === key} onClick={() => setPreset(key)}>
          {text}
          {counts[key] ? <span className="tabular-nums opacity-70">{counts[key]}</span> : null}
        </button>
      ))}
      {CAT.map(([key, text]) => (
        <button key={key} type="button" className={chip(preset === 'cat:' + key)} aria-pressed={preset === 'cat:' + key} onClick={() => setPreset('cat:' + key)}>
          {text}
        </button>
      ))}
    </div>
  );
}

// Telefonda alttaki bölüm çubuğu.
export function BottomNav({ view, dueReminders }) {
  return (
    <nav className="fixed inset-x-0 bottom-0 z-40 flex border-t bg-chrome pb-[env(safe-area-inset-bottom)] lg:hidden" aria-label="Bölümler">
      {SECTIONS.map(([key, text, Icon]) => {
        const on = sectionActive(key, view);
        return (
          <a
            key={key}
            href={'#' + key}
            aria-current={on ? 'page' : undefined}
            className={cn('relative flex min-w-0 flex-1 flex-col items-center gap-0.5 py-2 text-[10.5px] outline-none', on ? 'text-foreground' : 'text-muted-foreground')}
          >
            <span className={cn('relative flex h-7 w-11 items-center justify-center rounded-full', on && 'bg-accent text-accent-foreground')}>
              <Icon className="size-[18px]" />
              {key === 'hatirlatmalar' && dueReminders ? <span className="absolute right-1.5 top-0.5 size-2 rounded-full bg-high" /> : null}
            </span>
            {text}
          </a>
        );
      })}
    </nav>
  );
}
