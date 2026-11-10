import { Slot } from '@radix-ui/react-slot';
import { cva } from 'class-variance-authority';
import { cn } from '@/lib/cn';

export const buttonVariants = cva(
  'inline-flex shrink-0 items-center justify-center gap-2 whitespace-nowrap rounded-md text-sm font-medium transition-colors outline-none focus-visible:ring-2 focus-visible:ring-ring disabled:pointer-events-none disabled:opacity-50 [&_svg]:size-4 [&_svg]:shrink-0',
  {
    variants: {
      variant: {
        default: 'bg-primary text-primary-foreground shadow-[0_2px_0_rgba(0,0,0,.28)] hover:bg-primary/85',
        outline: 'border bg-chrome text-foreground shadow-[0_2px_0_rgba(0,0,0,.28)] hover:bg-muted',
        ghost: 'text-foreground hover:bg-muted',
        destructive: 'border border-destructive/60 text-destructive hover:bg-destructive/10',
        link: 'text-link underline-offset-4 hover:underline',
      },
      size: {
        default: 'h-9 px-3.5',
        sm: 'h-8 px-2.5 text-[13px]',
        icon: 'size-9',
      },
    },
    defaultVariants: { variant: 'default', size: 'default' },
  },
);

export function Button({ className, variant, size, asChild = false, type, ...props }) {
  const Comp = asChild ? Slot : 'button';
  return <Comp type={asChild ? undefined : type || 'button'} className={cn(buttonVariants({ variant, size }), className)} {...props} />;
}
