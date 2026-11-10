import { cn } from '@/lib/cn';

const base =
  'w-full rounded-md border border-input bg-chrome px-3 text-sm text-foreground placeholder:text-muted-foreground/70 outline-none transition-colors focus-visible:border-ring focus-visible:ring-2 focus-visible:ring-ring/40 disabled:opacity-60';

export function Input({ className, type = 'text', ...props }) {
  return <input type={type} className={cn(base, 'h-9', className)} {...props} />;
}

export function Textarea({ className, ...props }) {
  return <textarea className={cn(base, 'min-h-20 py-2', className)} {...props} />;
}
