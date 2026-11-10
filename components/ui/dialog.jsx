'use client';

import * as DialogPrimitive from '@radix-ui/react-dialog';
import { X } from 'lucide-react';
import { cn } from '@/lib/cn';

export const Dialog = DialogPrimitive.Root;
export const DialogClose = DialogPrimitive.Close;

// Telefonda alttan açılan sayfa, geniş ekranda sağdan açılan panel.
export function DialogContent({ className, title, children, ...props }) {
  return (
    <DialogPrimitive.Portal>
      <DialogPrimitive.Overlay className="fixed inset-0 z-50 bg-black/60" />
      <DialogPrimitive.Content
        aria-describedby={undefined}
        className={cn(
          'fixed inset-x-0 bottom-0 z-50 flex max-h-[92dvh] flex-col rounded-t-xl border bg-popover shadow-2xl outline-none',
          'sm:inset-y-0 sm:left-auto sm:right-0 sm:max-h-none sm:w-[560px] sm:rounded-none sm:border-y-0 sm:border-r-0',
          className,
        )}
        {...props}
      >
        <div className="flex items-center justify-between gap-3 border-b px-5 py-3.5">
          <DialogPrimitive.Title className="text-base font-semibold">{title}</DialogPrimitive.Title>
          <DialogPrimitive.Close className="rounded-md p-1.5 text-muted-foreground outline-none hover:bg-muted hover:text-foreground focus-visible:ring-2 focus-visible:ring-ring" aria-label="Kapat">
            <X className="size-4" />
          </DialogPrimitive.Close>
        </div>
        <div className="min-h-0 flex-1 overflow-y-auto px-5 py-4">{children}</div>
      </DialogPrimitive.Content>
    </DialogPrimitive.Portal>
  );
}
