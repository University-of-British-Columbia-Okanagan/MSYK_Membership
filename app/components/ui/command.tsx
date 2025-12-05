import * as React from "react";
import * as CommandPrimitive from "cmdk";

import { cn } from "@/lib/utils";

const Command = React.forwardRef<
  React.ElementRef<typeof CommandPrimitive.Command>,
  React.ComponentPropsWithoutRef<typeof CommandPrimitive.Command>
>(({ className, ...props }, ref) => (
  <CommandPrimitive.Command
    ref={ref}
    className={cn(
      "flex h-full w-full flex-col overflow-hidden rounded-md bg-popover text-popover-foreground",
      className
    )}
    {...props}
  />
));
Command.displayName = CommandPrimitive.Command.displayName;

const CommandInput = React.forwardRef<
  React.ElementRef<typeof CommandPrimitive.Command.Input>,
  React.ComponentPropsWithoutRef<typeof CommandPrimitive.Command.Input>
>(({ className, ...props }, ref) => (
  <div className="flex items-center border-b px-3" cmdk-input-wrapper="">
    <CommandPrimitive.Command.Input
      ref={ref}
      className={cn(
        "flex h-10 w-full rounded-md bg-transparent py-3 text-sm outline-none placeholder:text-muted-foreground disabled:cursor-not-allowed disabled:opacity-50",
        className
      )}
      {...props}
    />
  </div>
));
CommandInput.displayName = CommandPrimitive.Command.Input.displayName;

const CommandList = React.forwardRef<
  React.ElementRef<typeof CommandPrimitive.Command.List>,
  React.ComponentPropsWithoutRef<typeof CommandPrimitive.Command.List>
>(({ className, ...props }, ref) => (
  <CommandPrimitive.Command.List
    ref={ref}
    className={cn("max-h-60 overflow-y-auto overflow-x-hidden", className)}
    {...props}
  />
));
CommandList.displayName = CommandPrimitive.Command.List.displayName;

const CommandEmpty = React.forwardRef<
  React.ElementRef<typeof CommandPrimitive.Command.Empty>,
  React.ComponentPropsWithoutRef<typeof CommandPrimitive.Command.Empty>
>(({ className, ...props }, ref) => (
  <CommandPrimitive.Command.Empty
    ref={ref}
    className={cn("py-6 text-center text-sm", className)}
    {...props}
  />
));
CommandEmpty.displayName = CommandPrimitive.Command.Empty.displayName;

const CommandGroup = React.forwardRef<
  React.ElementRef<typeof CommandPrimitive.Command.Group>,
  React.ComponentPropsWithoutRef<typeof CommandPrimitive.Command.Group>
>(({ className, ...props }, ref) => (
  <CommandPrimitive.Command.Group
    ref={ref}
    className={cn(
      "overflow-hidden p-1 text-foreground [&_[cmdk-group-heading]]:px-2 [&_[cmdk-group-heading]]:py-1.5 [&_[cmdk-group-heading]]:text-xs [&_[cmdk-group-heading]]:font-medium [&_[cmdk-group-heading]]:text-muted-foreground",
      className
    )}
    {...props}
  />
));
CommandGroup.displayName = CommandPrimitive.Command.Group.displayName;

const CommandSeparator = React.forwardRef<
  React.ElementRef<typeof CommandPrimitive.Command.Separator>,
  React.ComponentPropsWithoutRef<typeof CommandPrimitive.Command.Separator>
>(({ className, ...props }, ref) => (
  <CommandPrimitive.Command.Separator
    ref={ref}
    className={cn("-mx-1 h-px bg-border", className)}
    {...props}
  />
));
CommandSeparator.displayName = CommandPrimitive.Command.Separator.displayName;

const CommandItem = React.forwardRef<
  React.ElementRef<typeof CommandPrimitive.Command.Item>,
  React.ComponentPropsWithoutRef<typeof CommandPrimitive.Command.Item>
>(({ className, ...props }, ref) => (
  <CommandPrimitive.Command.Item
    ref={ref}
    className={cn(
      "relative flex cursor-pointer select-none items-center gap-2 rounded-sm px-2 py-2 text-sm outline-none aria-selected:bg-accent aria-selected:text-accent-foreground data-[disabled=true]:pointer-events-none data-[disabled=true]:opacity-50",
      className
    )}
    {...props}
  />
));
CommandItem.displayName = CommandPrimitive.Command.Item.displayName;

const CommandShortcut = ({
  className,
  ...props
}: React.HTMLAttributes<HTMLSpanElement>) => (
  <span
    className={cn(
      "ml-auto text-xs tracking-widest text-muted-foreground",
      className
    )}
    {...props}
  />
);
CommandShortcut.displayName = "CommandShortcut";

export {
  Command,
  CommandInput,
  CommandList,
  CommandEmpty,
  CommandGroup,
  CommandItem,
  CommandShortcut,
  CommandSeparator,
};
