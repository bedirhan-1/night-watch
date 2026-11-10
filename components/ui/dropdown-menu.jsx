'use client';

import * as Menu from '@radix-ui/react-dropdown-menu';
import { cn } from '@/lib/cn';

export const DropdownMenu = Menu.Root;
export const DropdownMenuTrigger = Menu.Trigger;

export function DropdownMenuContent({ className, sideOffset = 6, ...props }) {
  return (
    <Menu.Portal>
      <Menu.Content
        sideOffset={sideOffset}
        className={cn('z-[60] min-w-40 overflow-hidden rounded-md border bg-popover p-1 text-foreground shadow-xl', className)}
        {...props}
      />
    </Menu.Portal>
  );
}

export function DropdownMenuItem({ className, ...props }) {
  return (
    <Menu.Item
      className={cn(
        'flex select-none items-center gap-2 rounded-sm px-2.5 py-1.5 text-sm outline-none data-[highlighted]:bg-accent data-[highlighted]:text-accent-foreground [&_svg]:size-4',
        className,
      )}
      {...props}
    />
  );
}

export function DropdownMenuLabel({ className, ...props }) {
  return <Menu.Label className={cn('px-2.5 py-1.5 text-xs text-muted-foreground', className)} {...props} />;
}

export function DropdownMenuSeparator({ className, ...props }) {
  return <Menu.Separator className={cn('-mx-1 my-1 h-px bg-border', className)} {...props} />;
}
