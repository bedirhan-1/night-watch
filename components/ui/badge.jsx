import { cva } from 'class-variance-authority';
import { cn } from '@/lib/cn';

export const badgeVariants = cva('inline-flex items-center gap-1 whitespace-nowrap rounded-full border px-2 py-0.5 text-xs font-medium', {
  variants: {
    variant: {
      default: 'border-border text-muted-foreground',
      primary: 'border-primary/60 bg-primary/15 text-link',
      crit: 'border-crit/60 bg-crit/15 text-crit',
      high: 'border-high/50 bg-high/15 text-high',
      done: 'border-done/40 bg-done/10 text-done',
      solid: 'border-crit bg-crit text-[#22060a]',
    },
  },
  defaultVariants: { variant: 'default' },
});

export function Badge({ className, variant, ...props }) {
  return <span className={cn(badgeVariants({ variant }), className)} {...props} />;
}
