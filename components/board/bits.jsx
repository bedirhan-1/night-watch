'use client';

import { createContext, useContext } from 'react';
import { Check } from 'lucide-react';
import { cn } from '@/lib/cn';
import { Badge } from '@/components/ui/badge';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger } from '@/components/ui/dropdown-menu';
import { ST, PR, SRC, label, initials, isLate, fmt } from '@/lib/board';

const ALL = '__all';

// Projedeki kişiler ve oturumdaki kullanıcı; pano sayfası sağlar.
export const PeopleContext = createContext({ people: [], me: null });
export const usePeople = () => useContext(PeopleContext).people;
export const useMe = () => useContext(PeopleContext).me;
export const personName = (p) => (p ? p.name || p.email.split('@')[0] : '');
// Sorumlu alanı kişi e-postası tutar; eski serbest metin değerleri olduğu gibi gösterilir.
export const ownerLabel = (people, owner) => {
  const p = people.find((x) => x.email === owner);
  return p ? personName(p) : owner || '';
};

// shadcn Select'in kısa hali. placeholder verilirse "hepsi" seçeneği eklenir ve boş değer ('') ona karşılık gelir.
export function Pick({ id, value, onChange, options, placeholder, className, ariaLabel }) {
  return (
    <Select value={value || (placeholder != null ? ALL : undefined)} onValueChange={(v) => onChange(v === ALL ? '' : v)}>
      <SelectTrigger id={id} className={className} aria-label={ariaLabel}>
        <SelectValue placeholder={placeholder} />
      </SelectTrigger>
      <SelectContent>
        {placeholder != null ? <SelectItem value={ALL}>{placeholder}</SelectItem> : null}
        {options.map(([v, l]) => (
          <SelectItem key={v} value={v}>
            {l}
          </SelectItem>
        ))}
      </SelectContent>
    </Select>
  );
}

// Sorumlu seçimi: projedeki kişiler. Listede olmayan eski bir değer varsa o da seçenek olarak kalır.
export function OwnerPick({ id, value, onChange, className }) {
  const people = usePeople();
  const options = people.map((p) => [p.email, p.name ? `${p.name} (${p.email})` : p.email]);
  if (value && !people.some((p) => p.email === value)) options.push([value, value]);
  return <Pick id={id} value={value} onChange={onChange} options={options} placeholder="Atanmamış" className={className} />;
}

export function Field({ label: text, htmlFor, className, children }) {
  return (
    <div className={cn('flex min-w-0 flex-col gap-1.5', className)}>
      <label htmlFor={htmlFor} className="text-xs font-medium text-muted-foreground">
        {text}
      </label>
      {children}
    </div>
  );
}

export function Empty({ children, className }) {
  return <div className={cn('rounded-lg border border-dashed px-4 py-8 text-center text-sm text-muted-foreground', className)}>{children}</div>;
}

export function Avatar({ name, src, className }) {
  const people = usePeople();
  const p = people.find((x) => x.email === name);
  const text = p ? personName(p) : name;
  const img = src || (p && p.avatar);
  const i = initials(text);
  if (img) return <img src={img} alt="" title={text} className={cn('size-7 shrink-0 rounded-full object-cover', className)} />;
  return (
    <span
      title={text || 'Atanmamış'}
      className={cn(
        'inline-flex size-7 shrink-0 items-center justify-center rounded-full text-[11px] font-semibold',
        i ? 'bg-primary/30 text-accent-foreground' : 'border border-dashed text-muted-foreground',
        className,
      )}
    >
      {i || '–'}
    </span>
  );
}

const BAR = { kritik: 'bg-crit', yuksek: 'bg-high', orta: 'bg-primary', dusuk: 'bg-muted-foreground/50' };
const LEVEL = { kritik: 3, yuksek: 3, orta: 2, dusuk: 1 };

// Sinyal çubuğu biçiminde öncelik göstergesi.
export function PriorityBars({ priority }) {
  const n = LEVEL[priority] || 0;
  return (
    <span className="inline-flex items-end gap-[2px]" aria-hidden="true">
      {[1, 2, 3].map((i) => (
        <span key={i} className={cn('w-[3px] rounded-[1px]', i <= n ? BAR[priority] : 'bg-muted-foreground/25')} style={{ height: 4 + i * 3 }} />
      ))}
    </span>
  );
}

export const priorityStripe = (r) => BAR[r.priority] || 'bg-muted-foreground/40';
const PV = { kritik: 'crit', yuksek: 'high', orta: 'primary', dusuk: 'default' };
const SV = { acik: 'default', devam: 'primary', beklemede: 'high', cozuldu: 'done' };

export function PriorityBadge({ priority }) {
  return (
    <Badge variant={PV[priority] || 'default'}>
      <PriorityBars priority={priority} />
      {label(PR, priority)}
    </Badge>
  );
}

export function StatusBadge({ status }) {
  return <Badge variant={SV[status] || 'default'}>{label(ST, status)}</Badge>;
}

export function LateBadge({ record }) {
  if (!isLate(record)) return null;
  return <Badge variant="solid">Gecikti · {fmt(record.dueDate)}</Badge>;
}

export function SourceBadge({ record }) {
  if (!record.source || !SRC[record.source]) return null;
  return (
    <>
      <Badge variant="primary">{SRC[record.source]} · otomatik</Badge>
      {record.occurrences > 1 ? <Badge title="Bu hata kaç kez geldi">{record.occurrences} kez</Badge> : null}
    </>
  );
}

// Claude ile düzeltme durumu. fix: state yanıtındaki record.fix.
export const FIX_STATE = {
  calisiyor: ['Claude çalışıyor', 'primary'],
  pr: ['PR hazır', 'done'],
  cozulemedi: ['Claude çözemedi', 'high'],
  tetiklenemedi: ['Claude: başlatılamadı', 'default'],
  sonuc_yok: ['Claude: sonuç yok', 'default'],
};

export function FixBadge({ fix }) {
  const s = fix && FIX_STATE[fix.state];
  if (!s) return null;
  return <Badge variant={s[1]}>{s[0]}</Badge>;
}

const pill = 'inline-flex h-7 items-center gap-1.5 rounded-full border bg-chrome px-2.5 text-xs font-medium outline-none hover:bg-muted focus-visible:ring-2 focus-visible:ring-ring';

// Tablodan çıkmadan öncelik ya da durum değiştirmek için açılır menü.
export function QuickMenu({ kind, value, onChange }) {
  const options = kind === 'priority' ? PR : ST;
  return (
    <DropdownMenu>
      <DropdownMenuTrigger className={pill} aria-label={kind === 'priority' ? 'Önceliği değiştir' : 'Durumu değiştir'} onClick={(e) => e.stopPropagation()}>
        {kind === 'priority' ? <PriorityBars priority={value} /> : null}
        {label(options, value)}
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end" onClick={(e) => e.stopPropagation()}>
        {options.map(([v, l]) => (
          <DropdownMenuItem key={v} onSelect={() => v !== value && onChange(v)}>
            {kind === 'priority' ? <PriorityBars priority={v} /> : null}
            <span className="flex-1">{l}</span>
            {v === value ? <Check /> : null}
          </DropdownMenuItem>
        ))}
      </DropdownMenuContent>
    </DropdownMenu>
  );
}
