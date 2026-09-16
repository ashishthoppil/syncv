"use client";

import * as React from "react";
import * as TooltipPrimitive from "@radix-ui/react-tooltip";

import { cn } from "@/lib/utils";

const TooltipProvider = TooltipPrimitive.Provider;

const Tooltip = TooltipPrimitive.Root;

const TooltipTrigger = TooltipPrimitive.Trigger;

const TooltipContent = React.forwardRef<
  React.ElementRef<typeof TooltipPrimitive.Content>,
  React.ComponentPropsWithoutRef<typeof TooltipPrimitive.Content>
>(({ className, sideOffset = 4, ...props }, ref) => (
  <TooltipPrimitive.Portal>
    <TooltipPrimitive.Content
      ref={ref}
      sideOffset={sideOffset}
      className={cn(
        // max-w keeps a long hint from running off the side of a 360px screen.
        "z-50 max-w-[min(18rem,calc(100vw-2rem))] overflow-hidden font-medium rounded-md bg-primary px-3 py-1.5 text-xs text-primary-foreground animate-in fade-in-0 zoom-in-95 data-[state=closed]:animate-out data-[state=closed]:fade-out-0 data-[state=closed]:zoom-out-95 data-[side=bottom]:slide-in-from-top-2 data-[side=left]:slide-in-from-right-2 data-[side=right]:slide-in-from-left-2 data-[side=top]:slide-in-from-bottom-2",
        className
      )}
      {...props}
    />
  </TooltipPrimitive.Portal>
));
TooltipContent.displayName = TooltipPrimitive.Content.displayName;

/**
 * A tooltip you can actually open on a phone.
 *
 * Radix opens tooltips on hover and focus only — it explicitly ignores touch
 * pointers — so a plain `Tooltip` around a help icon is inert on mobile, which
 * is where most of SynCV's visitors are. This keeps hover/focus working through
 * `onOpenChange` and adds an explicit tap toggle on top, with a hit area padded
 * out to a usable size.
 */
const TapTooltip = ({
  content,
  children,
  className,
}: {
  /** The hint text. Doubles as the trigger's accessible name. */
  content: string;
  children: React.ReactNode;
  className?: string;
}) => {
  const [open, setOpen] = React.useState(false);

  return (
    <TooltipPrimitive.Root open={open} onOpenChange={setOpen}>
      <TooltipPrimitive.Trigger
        type="button"
        aria-label={content}
        onClick={() => setOpen((isOpen) => !isOpen)}
        // Negative margin cancels the padding, so the hit area grows without
        // shifting the icon in the line of text it sits in.
        className={cn("-m-2 shrink-0 p-2", className)}
      >
        {children}
      </TooltipPrimitive.Trigger>
      <TooltipContent>{content}</TooltipContent>
    </TooltipPrimitive.Root>
  );
};

export {
  Tooltip,
  TooltipTrigger,
  TooltipContent,
  TooltipProvider,
  TapTooltip,
};
